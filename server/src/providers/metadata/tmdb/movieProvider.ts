import type { MediaMetadata, MetadataLookupOptions, MetadataProvider, MetadataSearchResult } from "../types.js";
import { TmdbClient } from "./client.js";

export class TmdbMovieProvider implements MetadataProvider {
  readonly id = "tmdb-movie";
  readonly mediaType = "movie" as const;
  private readonly client: TmdbClient | undefined;

  constructor(apiKey: string | undefined) {
    this.client = apiKey ? new TmdbClient(apiKey) : undefined;
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): TmdbClient {
    if (!this.client) throw new Error("TMDB provider is not configured (missing TMDB_API_KEY)");
    return this.client;
  }

  async search(query: string, year?: number): Promise<MetadataSearchResult[]> {
    const { results } = await this.requireClient().searchMovies(query, year);
    return results.map((r) => ({
      externalId: String(r.id),
      title: r.title,
      ...(r.release_date ? { year: Number(r.release_date.slice(0, 4)) } : {}),
      ...(r.overview ? { overview: r.overview } : {}),
      ...(TmdbClient.posterUrl(r.poster_path) ? { posterUrl: TmdbClient.posterUrl(r.poster_path)! } : {}),
    }));
  }

  async getDetails(externalId: string, _options?: MetadataLookupOptions): Promise<MediaMetadata> {
    const movie = await this.requireClient().getMovie(externalId);
    return {
      provider: this.id,
      externalId: String(movie.id),
      title: movie.title,
      ...(movie.release_date ? { year: Number(movie.release_date.slice(0, 4)) } : {}),
      ...(movie.overview ? { overview: movie.overview } : {}),
      genres: movie.genres.map((g) => g.name),
      ...(TmdbClient.posterUrl(movie.poster_path) ? { posterUrl: TmdbClient.posterUrl(movie.poster_path)! } : {}),
      ...(TmdbClient.posterUrl(movie.backdrop_path) ? { backdropUrl: TmdbClient.posterUrl(movie.backdrop_path)! } : {}),
      ...(movie.vote_average !== undefined ? { rating: movie.vote_average } : {}),
    };
  }
}
