import type { MediaType } from "../../db/schema.js";

export interface MetadataSearchResult {
  externalId: string;
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
  /** Music only — populated by MusicBrainzProvider so callers can score a match without an
   * extra getDetails() round-trip per candidate. */
  artist?: string;
  durationSeconds?: number;
}

export interface MediaMetadata {
  provider: string;
  externalId: string;
  title: string;
  year?: number;
  overview?: string;
  genres: string[];
  posterUrl?: string;
  backdropUrl?: string;
  rating?: number;
  // TV / anime specific
  season?: number;
  episode?: number;
  episodeTitle?: string;
  // Music specific
  artist?: string;
  album?: string;
  trackNumber?: number;
  /** 0-100, only set by the music confidence-matching path in fetchMetadata.ts (see
   * services/musicMatching) — how sure the system is this is the right match, surfaced on the
   * final-approval gate so an admin can see an uncertain match before it goes live. */
  matchConfidence?: number;
}

export interface MetadataLookupOptions {
  season?: number;
  episode?: number;
}

/** Common interface every metadata backend (TMDB, AniList, MusicBrainz, ...) must implement. */
export interface MetadataProvider {
  readonly id: string;
  readonly mediaType: MediaType;

  isConfigured(): boolean;
  search(query: string, year?: number): Promise<MetadataSearchResult[]>;
  getDetails(externalId: string, options?: MetadataLookupOptions): Promise<MediaMetadata>;
}
