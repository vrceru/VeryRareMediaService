# VeryRare Media Service (VRMS)

VRMS automates the full lifecycle of media acquisition for a self-hosted Jellyfin library: it
takes a media request, searches configured download providers, downloads and verifies the
release, extracts and validates the files, fetches metadata, renames and organizes everything
into your library, and notifies Jellyfin and you when it's done.

## Repository layout

```
server/   Backend service — the pipeline, job queue, REST API (see server/README or docs/)
web/      Next.js frontend scaffold (dashboard UI is future work; the API is dashboard-ready)
docs/     Architecture, environment variables, API reference, provider/pipeline docs
```

## Quick start

```bash
cd server
cp .env.example .env   # fill in the integrations you actually have (see docs/environment-variables.md)
npm install
npm run dev
```

The API listens on `http://localhost:8787` by default (`/api/health` is a good first check).
Nothing external is required to boot — every integration (qBittorrent, TMDB, Jellyfin, Discord)
is optional and simply reports as "not configured" in `/api/health` and `/api/config` until you
set its environment variables.

## Documentation

- [Architecture](docs/architecture.md) — how the pieces fit together
- [Environment variables](docs/environment-variables.md) — full reference, nothing is hardcoded
- [Pipeline](docs/pipeline.md) — the stages a media request goes through
- [Providers](docs/providers.md) — download and metadata provider interfaces, what's implemented
- [Release name parsing](docs/release-parsing.md) — how release names are turned into structured title/year/season/episode/quality data
- [Admin approval workflow](docs/approvals.md) — the two optional pause points for human review before download and before a file goes live
- [YouTube playlist ingestion](docs/youtube-ingestion.md) — optional playlist → music job ingestion, with confidence-scored metadata matching and playlist verification
- [API](docs/api.md) — REST endpoint reference

## Status

The core pipeline, job queue, REST API, and one real implementation per provider category
(qBittorrent for downloads; TMDB/AniList/MusicBrainz for metadata) are implemented and tested.
See [docs/providers.md](docs/providers.md) for what's stubbed vs. real.
