import type { MediaMetadata, MetadataLookupOptions, MetadataProvider, MetadataSearchResult } from "../types.js";
import { AniListClient } from "./client.js";
import type { AniListMedia } from "./client.js";

function bestTitle(title: AniListMedia["title"]): string {
  return title.english ?? title.romaji ?? "Unknown";
}

/** AniList is a free, keyless public GraphQL API — always configured. */
export class AniListProvider implements MetadataProvider {
  readonly id = "anilist";
  readonly mediaType = "anime" as const;
  private readonly client = new AniListClient();

  isConfigured(): boolean {
    return true;
  }

  async search(query: string): Promise<MetadataSearchResult[]> {
    const results = await this.client.search(query);
    return results.map((m) => ({
      externalId: String(m.id),
      title: bestTitle(m.title),
      ...(m.startDate?.year ? { year: m.startDate.year } : {}),
      ...(m.description ? { overview: m.description } : {}),
      ...(m.coverImage?.large ? { posterUrl: m.coverImage.large } : {}),
    }));
  }

  async getDetails(externalId: string, options?: MetadataLookupOptions): Promise<MediaMetadata> {
    const m = await this.client.getById(Number(externalId));
    return {
      provider: this.id,
      externalId: String(m.id),
      title: bestTitle(m.title),
      ...(m.startDate?.year ? { year: m.startDate.year } : {}),
      ...(m.description ? { overview: m.description } : {}),
      genres: m.genres ?? [],
      ...(m.coverImage?.large ? { posterUrl: m.coverImage.large } : {}),
      ...(m.bannerImage ? { backdropUrl: m.bannerImage } : {}),
      ...(m.averageScore !== undefined ? { rating: m.averageScore / 10 } : {}),
      ...(options?.season !== undefined ? { season: options.season } : {}),
      ...(options?.episode !== undefined ? { episode: options.episode } : {}),
    };
  }
}
