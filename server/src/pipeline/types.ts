import type { AppContext } from "../appContext.js";
import type { Job } from "../queue/types.js";
import type { ReleaseCandidate } from "../providers/download/types.js";
import type { DownloadProvider } from "../providers/download/types.js";
import type { MediaMetadata, MetadataSearchResult } from "../providers/metadata/types.js";
import type { ParsedRelease } from "../services/releaseParsing/types.js";

export interface PipelineState {
  releaseCandidates?: ReleaseCandidate[];
  selectedRelease?: ReleaseCandidate;
  parsedRelease?: ParsedRelease;
  downloadProvider?: DownloadProvider;
  tempDir?: string;
  downloadSavePath?: string;
  mediaFiles?: string[];
  primaryMediaFile?: string;
  metadataSearchResults?: MetadataSearchResult[];
  metadata?: MediaMetadata;
  destinationPath?: string;
  /** Destination for every valid media file in the release, not just the primary one — a batch
   * release (e.g. a full season pack) has one entry per episode. */
  destinationPaths?: { source: string; destination: string }[];
  organizedItemDir?: string;
}

export interface PipelineContext {
  app: AppContext;
  job: Job;
  state: PipelineState;
}

export class PipelineStageError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
  ) {
    super(message);
    this.name = "PipelineStageError";
  }
}
