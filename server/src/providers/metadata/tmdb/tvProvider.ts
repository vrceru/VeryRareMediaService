import type { MediaMetadata, MetadataLookupOptions, MetadataProvider, MetadataSearchResult } from "../types.js";
import { TmdbClient } from "./client.js";

export class TmdbTvProvider implements MetadataProvider {
  readonly id = "tmdb-tv";
  readonly mediaType = "show" as const;
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
    const { results } = await this.requireClient().searchTv(query, year);
    return results.map((r) => ({
      externalId: String(r.id),
      title: r.name,
      ...(r.first_air_date ? { year: Number(r.first_air_date.slice(0, 4)) } : {}),
      ...(r.overview ? { overview: r.overview } : {}),
      ...(TmdbClient.posterUrl(r.poster_path) ? { posterUrl: TmdbClient.posterUrl(r.poster_path)! } : {}),
    }));
  }

  async getDetails(externalId: string, options?: MetadataLookupOptions): Promise<MediaMetadata> {
    const client = this.requireClient();
    const show = await client.getTv(externalId);

    let episodeTitle: string | undefined;
    if (options?.season !== undefined && options?.episode !== undefined) {
      try {
        const episode = await client.getEpisode(externalId, options.season, options.episode);
        episodeTitle = episode.name;
      } catch {
        // Episode metadata is best-effort; fall through without it.
      }
    }

    return {
      provider: this.id,
      externalId: String(show.id),
      title: show.name,
      ...(show.first_air_date ? { year: Number(show.first_air_date.slice(0, 4)) } : {}),
      ...(show.overview ? { overview: show.overview } : {}),
      genres: show.genres.map((g) => g.name),
      ...(TmdbClient.posterUrl(show.poster_path) ? { posterUrl: TmdbClient.posterUrl(show.poster_path)! } : {}),
      ...(TmdbClient.posterUrl(show.backdrop_path) ? { backdropUrl: TmdbClient.posterUrl(show.backdrop_path)! } : {}),
      ...(show.vote_average !== undefined ? { rating: show.vote_average } : {}),
      ...(options?.season !== undefined ? { season: options.season } : {}),
      ...(options?.episode !== undefined ? { episode: options.episode } : {}),
      ...(episodeTitle ? { episodeTitle } : {}),
    };
  }
}
