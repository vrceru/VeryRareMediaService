const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const COVER_ART_BASE_URL = "https://coverartarchive.org";
// MusicBrainz requires a descriptive User-Agent identifying the application.
const USER_AGENT = "VeryRareMediaService/0.1 (self-hosted media automation)";

export interface MbArtistCredit {
  name: string;
}

export interface MbReleaseSummary {
  id: string;
  title: string;
  date?: string;
  "artist-credit"?: MbArtistCredit[];
}

export interface MbReleaseDetails extends MbReleaseSummary {
  genres?: { name: string }[];
}

export class MusicBrainzClient {
  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${MUSICBRAINZ_BASE_URL}${path}`);
    url.searchParams.set("fmt", "json");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      throw new Error(`MusicBrainz request failed: ${path} -> ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async searchReleases(query: string): Promise<MbReleaseSummary[]> {
    const data = await this.get<{ releases: MbReleaseSummary[] }>("/release", { query });
    return data.releases ?? [];
  }

  async getRelease(mbid: string): Promise<MbReleaseDetails> {
    return this.get(`/release/${mbid}`, { inc: "artist-credits+genres" });
  }

  static coverArtUrl(mbid: string): string {
    return `${COVER_ART_BASE_URL}/release/${mbid}/front`;
  }
}
