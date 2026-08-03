import type { MediaMetadata, MetadataLookupOptions, MetadataProvider, MetadataSearchResult } from "../types.js";
import { MusicBrainzClient } from "./client.js";
import type { MbReleaseSummary } from "./client.js";

function artistName(release: MbReleaseSummary): string | undefined {
  return release["artist-credit"]?.[0]?.name;
}

/** MusicBrainz is a free, keyless public API — always configured. */
export class MusicBrainzProvider implements MetadataProvider {
  readonly id = "musicbrainz";
  readonly mediaType = "music" as const;
  private readonly client = new MusicBrainzClient();

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, year?: number): Promise<MetadataSearchResult[]> {
    const q = year ? `${query} AND date:${year}` : query;
    const releases = await this.client.searchReleases(q);
    return releases.map((r) => ({
      externalId: r.id,
      title: r.title,
      ...(r.date ? { year: Number(r.date.slice(0, 4)) } : {}),
      posterUrl: MusicBrainzClient.coverArtUrl(r.id),
    }));
  }

  async getDetails(externalId: string, options?: MetadataLookupOptions): Promise<MediaMetadata> {
    const release = await this.client.getRelease(externalId);
    return {
      provider: this.id,
      externalId: release.id,
      title: release.title,
      ...(release.date ? { year: Number(release.date.slice(0, 4)) } : {}),
      genres: release.genres?.map((g) => g.name) ?? [],
      posterUrl: MusicBrainzClient.coverArtUrl(release.id),
      album: release.title,
      ...(artistName(release) ? { artist: artistName(release)! } : {}),
      ...(options?.episode !== undefined ? { trackNumber: options.episode } : {}),
    };
  }
}
