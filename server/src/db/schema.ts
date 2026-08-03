export const JOB_STATUSES = [
  "pending",
  "running",
  "paused",
  "awaiting_release_approval",
  "awaiting_final_approval",
  "completed",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const MEDIA_TYPES = ["movie", "show", "anime", "music"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Row shape as stored in the `jobs` table (snake_case, JSON columns as strings). */
export interface JobRow {
  id: string;
  status: JobStatus;
  stage: string;
  media_type: MediaType | null;
  title: string;
  request_payload: string;
  selected_release: string | null;
  release_candidates: string | null;
  metadata: string | null;
  primary_media_file: string | null;
  download_provider_id: string | null;
  download_ref: string | null;
  progress: number;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_attempt_at: number | null;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
}

/** Row shape as stored in the `job_history` table. */
export interface JobHistoryRow {
  id: number;
  job_id: string;
  stage: string;
  status: string;
  message: string | null;
  created_at: number;
}
