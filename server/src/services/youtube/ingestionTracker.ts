import type { Db } from "../../db/client.js";

interface IngestedTrackRow {
  video_id: string;
  playlist_id: string | null;
  job_id: string;
  ingested_at: number;
}

export interface IngestedTrack {
  videoId: string;
  playlistId: string | null;
  jobId: string;
  ingestedAt: number;
}

function rowToTrack(row: IngestedTrackRow): IngestedTrack {
  return { videoId: row.video_id, playlistId: row.playlist_id, jobId: row.job_id, ingestedAt: row.ingested_at };
}

/**
 * Pre-download dedup + playlist-sync record: one row per YouTube video ID that's already been
 * turned into a VRMS job. Re-running the same playlist checks this before enqueuing anything,
 * so already-ingested tracks are skipped and only genuinely new ones get a new job.
 */
export class IngestionTracker {
  constructor(private readonly db: Db) {}

  isIngested(videoId: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM youtube_ingested_tracks WHERE video_id = ?`).get(videoId);
    return row !== undefined;
  }

  record(videoId: string, playlistId: string | undefined, jobId: string): void {
    this.db
      .prepare(
        `INSERT INTO youtube_ingested_tracks (video_id, playlist_id, job_id, ingested_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(video_id) DO NOTHING`,
      )
      .run(videoId, playlistId ?? null, jobId, Date.now());
  }

  listForPlaylist(playlistId: string): IngestedTrack[] {
    const rows = this.db
      .prepare(`SELECT * FROM youtube_ingested_tracks WHERE playlist_id = ?`)
      .all(playlistId) as unknown as IngestedTrackRow[];
    return rows.map(rowToTrack);
  }
}
