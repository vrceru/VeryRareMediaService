import { randomUUID } from "node:crypto";
import type { Db } from "../../db/client.js";

interface PlaylistRunRow {
  id: string;
  playlist_url: string;
  playlist_title: string | null;
  discovered: number;
  enqueued: number;
  skipped_duplicate: number;
  failed: number;
  job_ids: string;
  started_at: number;
  finished_at: number | null;
}

export interface PlaylistRun {
  id: string;
  playlistUrl: string;
  playlistTitle: string | null;
  discovered: number;
  enqueued: number;
  skippedDuplicate: number;
  failed: number;
  jobIds: string[];
  startedAt: number;
  finishedAt: number | null;
}

function rowToRun(row: PlaylistRunRow): PlaylistRun {
  return {
    id: row.id,
    playlistUrl: row.playlist_url,
    playlistTitle: row.playlist_title,
    discovered: row.discovered,
    enqueued: row.enqueued,
    skippedDuplicate: row.skipped_duplicate,
    failed: row.failed,
    jobIds: JSON.parse(row.job_ids) as string[],
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

/** One row per playlist-ingestion API call — the discovered/enqueued/skipped/failed summary. */
export class PlaylistRunTracker {
  constructor(private readonly db: Db) {}

  start(playlistUrl: string): string {
    const id = randomUUID();
    this.db
      .prepare(`INSERT INTO youtube_playlist_runs (id, playlist_url, started_at) VALUES (?, ?, ?)`)
      .run(id, playlistUrl, Date.now());
    return id;
  }

  finish(
    id: string,
    result: {
      playlistTitle?: string;
      discovered: number;
      enqueued: number;
      skippedDuplicate: number;
      failed: number;
      jobIds: string[];
    },
  ): void {
    this.db
      .prepare(
        `UPDATE youtube_playlist_runs
         SET playlist_title = ?, discovered = ?, enqueued = ?, skipped_duplicate = ?, failed = ?,
             job_ids = ?, finished_at = ?
         WHERE id = ?`,
      )
      .run(
        result.playlistTitle ?? null,
        result.discovered,
        result.enqueued,
        result.skippedDuplicate,
        result.failed,
        JSON.stringify(result.jobIds),
        Date.now(),
        id,
      );
  }

  get(id: string): PlaylistRun | undefined {
    const row = this.db.prepare(`SELECT * FROM youtube_playlist_runs WHERE id = ?`).get(id) as unknown as
      | PlaylistRunRow
      | undefined;
    return row ? rowToRun(row) : undefined;
  }
}
