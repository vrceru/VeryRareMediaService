import type { AppConfig } from "../../config/index.js";
import type { MediaType } from "../../db/schema.js";
import type { MetadataProvider } from "./types.js";
import { TmdbMovieProvider } from "./tmdb/movieProvider.js";
import { TmdbTvProvider } from "./tmdb/tvProvider.js";
import { AniListProvider } from "./anilist/provider.js";
import { MusicBrainzProvider } from "./musicbrainz/provider.js";

export class MetadataProviderRegistry {
  private readonly byMediaType = new Map<MediaType, MetadataProvider>();

  constructor(config: AppConfig) {
    this.byMediaType.set("movie", new TmdbMovieProvider(config.tmdb?.apiKey));
    this.byMediaType.set("show", new TmdbTvProvider(config.tmdb?.apiKey));
    this.byMediaType.set("anime", new AniListProvider());
    this.byMediaType.set("music", new MusicBrainzProvider());
  }

  get(mediaType: MediaType): MetadataProvider {
    const provider = this.byMediaType.get(mediaType);
    if (!provider) throw new Error(`No metadata provider registered for media type "${mediaType}"`);
    return provider;
  }

  list(): MetadataProvider[] {
    return [...this.byMediaType.values()];
  }
}
