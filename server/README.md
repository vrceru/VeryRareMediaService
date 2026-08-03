# VRMS Backend

The media automation pipeline: job queue, download/metadata providers, Jellyfin integration,
notifications, and REST API. See the root [README](../README.md) and [docs/](../docs) for the
full picture — this file covers only local dev commands.

## Setup

```bash
cp .env.example .env   # fill in the integrations you have
npm install
npm run dev             # tsx watch, http://localhost:8787
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `tests/` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Notes

- Uses Node's built-in `node:sqlite` (no native build step) — see
  [docs/architecture.md](../docs/architecture.md#why-no-drizzlebetter-sqlite3) for why.
- Every external integration is optional; the process boots with none configured and reports
  their status via `GET /api/health`.
