# Release Name Parsing

`server/src/services/releaseParsing/` extracts structured information out of scene- and
anime-style release names — the strings download providers return from search, e.g.:

```
The.Movie.Title.2020.1080p.BluRay.x264-GROUP
Show.Name.S02E05.720p.WEB-DL.DDP5.1.H264-GROUP
[SubsPlease] Show Name - 05 [1080p].mkv
```

It's a heuristic regex-based parser (same approach Sonarr/Radarr use), not a full grammar —
it covers the common naming conventions, not every possible release name.

## `parseReleaseName(rawName: string): ParsedRelease`

```ts
interface ParsedRelease {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeEnd?: number;       // multi-episode releases, e.g. S01E01-E03
  resolution?: string;        // "2160p" | "1080p" | "720p" | ...
  source?: string;            // "bluray" | "webdl" | "webrip" | "hdtv" | "dvd" | "cam" | ...
  codec?: string;             // "av1" | "hevc" | "avc" | "xvid" | "divx"
  audioCodec?: string;        // "truehd" | "atmos" | "dtshd" | "dts" | "eac3" | "ac3" | "flac" | "aac" | "mp3"
  releaseGroup?: string;
  groupStyle?: "prefix" | "suffix"; // "[Group] ..." (anime convention) vs "...-GROUP" (scene convention)
  isProper: boolean;
  isRepack: boolean;
}
```

Parsing strategy: strip a known file extension, pull off the release group (leading `[Group]`
bracket or trailing `-GROUP`), then scan for resolution/source/codec/audio/proper/repack tags
and a season+episode marker (`SxxEyy`, `1x02`, "Season X Episode Y", or the anime convention of
a bare ` - NN ` episode number with no season). The year is searched for only in the region
before any season/episode match, so episode numbers are never misread as a year. The title is
everything before the earliest matched tag, with dots/underscores turned into spaces.

## `computeQualityScore(parsed: ParsedRelease): number`

Returns a 0-1 technical-quality score from a lookup table: resolution weighted heaviest (50%),
then source (35%, `bluray` > `webdl` > `webrip` > `hdtv` > `dvd` > `cam`), then codec (15%,
`av1`/`hevc` > `avc` > `xvid`), plus a small bump for `PROPER`/`REPACK` releases.

## `computeRelevanceScore(parsed: ParsedRelease, request: MediaRequest): number`

Returns a 0-1 score for how well the parsed release matches the request's explicit
`year`/`season`/`episode`. Starts at 1 and is only docked when both the request and the parsed
release specify a field and they disagree — missing information is never treated as a mismatch,
since most requests don't pin down every field.

## Where it's used

- **`pipeline/stages/selectRelease.ts`** — parses every candidate's title and ranks them by
  `providerQualityScore * 0.4 + technicalQualityScore * 0.4 + relevanceScore * 0.2`, stashing
  the winning `ParsedRelease` in pipeline state for later stages.
- **`pipeline/stages/identifyMedia.ts`** — a `groupStyle: "prefix"` (the `[Group]` anime/fansub
  convention) or a parsed season+episode pair are stronger signals than the raw-title regexes
  alone.
- **`pipeline/stages/fetchMetadata.ts`** — falls back to the parsed release's `year`/`season`/
  `episode` when the original request didn't specify them (a request for just "Show Name" still
  gets the right episode's metadata once a specific release is selected).
