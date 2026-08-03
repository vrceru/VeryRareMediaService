import type { JobStatus, MediaType } from "../db/schema.js";
import type { ReleaseCandidate } from "../providers/download/types.js";
import type { MediaMetadata } from "../providers/metadata/types.js";

export interface MediaRequest {
  title: string;
  mediaType?: MediaType;
  year?: number;
  season?: number;
  episode?: number;
  /** Free-text search override; defaults to title when absent. */
  searchQuery?: string;
  /** Exact external ID for the metadata provider that will serve `mediaType` (TMDB numeric ID
   * for movie/show, AniList numeric ID for anime, MusicBrainz MBID for music). When present,
   * fetchMetadata.ts calls getDetails() directly instead of search()+best-guess — use this
   * whenever the caller already resolved an exact match (e.g. a Discord bot's own TMDB search
   * UI), so VRMS's own metadata lookup can't land on a different same-titled entry. */
  metadataId?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  stage: string;
  mediaType: MediaType | null;
  title: string;
  request: MediaRequest;
  selectedRelease: ReleaseCandidate | null;
  /** Snapshot of search results taken at the release-approval gate, for admin review. */
  releaseCandidates: ReleaseCandidate[] | null;
  /** Persisted once fetchMetadata runs, so the final-approval gate (and its resume) has it
   * without needing a redundant network round-trip. */
  metadata: MediaMetadata | null;
  /** The file validateMedia picked, needed to resume at renameFiles after final approval. */
  primaryMediaFile: string | null;
  downloadProviderId: string | null;
  downloadRef: string | null;
  progress: number;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  nextAttemptAt: number | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface JobHistoryEntry {
  id: number;
  jobId: string;
  stage: string;
  status: string;
  message: string | null;
  createdAt: number;
}

export interface JobListFilter {
  status?: JobStatus | JobStatus[];
  limit?: number;
  offset?: number;
}
