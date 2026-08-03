const ANILIST_URL = "https://graphql.anilist.co";

export interface AniListMediaTitle {
  romaji?: string;
  english?: string;
}

export interface AniListMedia {
  id: number;
  title: AniListMediaTitle;
  startDate?: { year?: number };
  description?: string;
  coverImage?: { large?: string };
  bannerImage?: string;
  genres?: string[];
  averageScore?: number;
}

async function query<T>(gql: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) {
    throw new Error(`AniList request failed: ${res.status}`);
  }
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`AniList error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data;
}

const SEARCH_QUERY = `
  query ($search: String) {
    Page(perPage: 10) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english }
        startDate { year }
        description(asHtml: false)
        coverImage { large }
      }
    }
  }
`;

const DETAILS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english }
      startDate { year }
      description(asHtml: false)
      coverImage { large }
      bannerImage
      genres
      averageScore
    }
  }
`;

export class AniListClient {
  async search(searchTerm: string): Promise<AniListMedia[]> {
    const data = await query<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
      search: searchTerm,
    });
    return data.Page.media;
  }

  async getById(id: number): Promise<AniListMedia> {
    const data = await query<{ Media: AniListMedia }>(DETAILS_QUERY, { id });
    return data.Media;
  }
}
