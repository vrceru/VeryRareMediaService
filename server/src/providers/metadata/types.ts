import type { MediaType } from "../../db/schema.js";

export interface MetadataSearchResult {
  externalId: string;
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
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
