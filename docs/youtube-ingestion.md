# YouTube Playlist → Music Ingestion

An optional, opt-in ingestion source: submit a YouTube playlist URL and VRMS resolves it into
one job per track, each flowing through the **exact same pipeline** every other job uses —
search/select, the release-approval gate, download, virus scan, validation, identification,
confidence-scored metadata matching, the final-approval gate, organization, and Jellyfin update.
Nothing about the existing pipeline, security layer, or approval architecture is different for a
YouTube-sourced job; see [pipeline.md](pipeline.md) and [approvals.md](approvals.md) for those.

## Why it's structured this way

A YouTube playlist track is, structurally, a release candidate with exactly one option — the
video itself. That's the same shape `qbittorrent`/`sabnzbd` already produce (just always a
single-candidate result instead of many), so the whole feature is implemented as another
`DownloadProvider` (`providers/download/youtube/`) plus a small orchestrator that resolves a
playlist and enqueues one job per track via the existing `POST`-equivalent
`QueueService.enqueue()` — not a parallel processing path.

## Configuration

```
YOUTUBE_INGESTION_ENABLED=false   # opt-in; the whole feature is inert until this is true
YTDLP_PATH=yt-dlp                  # binary must be on PATH, or point this at it directly
YOUTUBE_AUDIO_FORMAT=best           # passed to `yt-dlp -x --audio-format` — "best" = no forced re-encode
YOUTUBE_MAX_CONCURRENT_DOWNLOADS=2

METADATA_CONFIDENCE_STRONG=95      # >= this: confident match
METADATA_CONFIDENCE_GOOD=80         # >= this: good match
METADATA_CONFIDENCE_UNCERTAIN=60    # >= this: proceeds, but flagged at the final-approval gate
                                     # below this: the job fails outright rather than guess
```

**System requirements**: the `yt-dlp` and `ffmpeg` binaries must be installed and reachable —
this is the first VRMS feature that shells out to an external process; everything else talks
HTTP or raw TCP. Neither is bundled.

**Public content only, by design**: no account cookies/authentication support is implemented.
This only fetches what's reachable from a public playlist/video URL. As with the torrent/usenet
providers, the operator is responsible for only ingesting media they're authorized to obtain.

## Usage

```bash
curl -X POST http://localhost:8787/api/ingest/youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/playlist?list=PL..."}'
```

Returns immediately with a discovery/enqueue summary (resolving a playlist is fast — no audio is
downloaded at this point):

```json
{
  "runId": "...",
  "playlistTitle": "Example Playlist",
  "discovered": 42,
  "enqueued": 39,
  "skippedDuplicate": 2,
  "failed": 1,
  "jobIds": ["...", "..."],
  "failures": [{ "videoId": "...", "title": "...", "reason": "..." }],
  "unaccountedFor": []
}
```

Each enqueued track then proceeds through the normal pipeline asynchronously — track it like any
other job via `GET /api/jobs/:id`, or check on the whole run via
`GET /api/ingest/youtube/:runId`, which adds a `liveCounts` breakdown (how many of the enqueued
jobs are currently `pending`/`running`/`completed`/etc.).

**Re-running the same playlist is safe** — already-ingested tracks (tracked by YouTube video ID,
independent of anything about the job's own outcome) are skipped, so re-submitting a playlist
only enqueues genuinely new tracks. If a playlist gained one new track since last time, exactly
one new job gets created.

### Verifying nothing is missing

Two independent mechanisms, since a bug in the ingestion loop itself shouldn't be the only thing
standing between "looks fine" and "actually complete":

1. **Within a single run**: every discovered track must land in exactly one of
   enqueued/skippedDuplicate/failed. If the accounting doesn't add up (a bug, not a track's own
   failure), the mismatched video IDs come back in `unaccountedFor` and get logged loudly rather
   than silently disappearing.
2. **On demand, independent of any run's own bookkeeping**:

   ```bash
   curl "http://localhost:8787/api/ingest/youtube/verify?url=<playlist-url>"
   ```

   Re-resolves the playlist live and diffs it against what's actually recorded as ingested,
   answering "is anything missing right now" rather than "did the last run think it got
   everything":

   ```json
   {
     "playlistTitle": "Example Playlist",
     "liveTrackCount": 43,
     "ingestedCount": 42,
     "missingTracks": [{ "videoId": "...", "title": "...", "url": "..." }],
     "removedFromPlaylist": []
   }
   ```

## Metadata matching

YouTube video titles are source metadata, not authoritative — a title like
`Some Artist - Some Song (Official Audio)` gets noise-stripped and split into
`{ artist: "Some Artist", title: "Some Song" }` (`services/musicMatching/parseYoutubeTitle.ts`),
then every MusicBrainz search result is scored against it (title + artist similarity, plus
duration closeness when known — `services/musicMatching/scoreMatch.ts`) rather than blindly
taking the first result. This only activates for `mediaType: "music"` — movie/show/anime metadata
matching is untouched.

| Score | What happens |
|---|---|
| ≥ `STRONG` (95) | Confident match |
| ≥ `GOOD` (80) | Good match |
| ≥ `UNCERTAIN` (60) | Proceeds, but the score is attached to the metadata (`matchConfidence`) so it's visible on the **existing** final-approval gate (`GET /api/approvals/final`) — no separate approval system for uncertain YouTube matches |
| < `UNCERTAIN` | The job fails outright at the `fetch_metadata` stage rather than organizing a probably-wrong match |

## Duplicate detection

- **Before downloading**: video ID lookup against `youtube_ingested_tracks` — the cheapest, exact
  check, and what makes playlist re-processing a no-op for existing tracks.
- **At organize time**: unchanged — `organizeLibrary.ts`'s existing checksum-based
  `findDuplicate` (see [providers.md](providers.md)) already runs for every job type, so a
  YouTube track that happens to match a file already in the library is skipped the same way any
  other duplicate is.

## Failure handling

One track's failure (a bad URL, a `yt-dlp` error, an enqueue exception) doesn't stop the rest of
the playlist — caught per-track in the orchestrator, recorded in `failures`, and the loop
continues. Once a track becomes a real VRMS job, its failure handling is identical to any other
job's (retry with backoff, then `failed` — see [pipeline.md](pipeline.md#failure-handling)).

## Security

- **Host allowlist** (`providers/download/youtube/urlValidation.ts`): every playlist/video URL is
  checked against a `youtube.com`/`youtu.be`/`music.youtube.com` allowlist before it's ever
  handed to `yt-dlp`. `yt-dlp` itself supports thousands of sites — without this check, the
  ingestion endpoint would effectively be a generic arbitrary-URL downloader.
- **Filenames/paths**: unchanged — the existing `sanitizeFilename`/`resolveWithinRoot` guards
  (see [approvals.md](approvals.md) and the codebase's `security/` module) apply to every file
  this produces, same as any other provider's output.
- **No credentials in play**: no account auth is supported, so there's nothing secret to leak
  into logs for this feature specifically.
