const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

export interface TmdbMovieSummary {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
}

export interface TmdbTvSummary {
  id: number;
  name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  genres: { id: number; name: string }[];
  backdrop_path?: string | null;
  vote_average?: number;
}

export interface TmdbTvDetails extends TmdbTvSummary {
  genres: { id: number; name: string }[];
  backdrop_path?: string | null;
  vote_average?: number;
}

export interface TmdbEpisodeDetails {
  name: string;
  overview?: string;
  season_number: number;
  episode_number: number;
}

export class TmdbClient {
  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TMDB_BASE_URL}${path}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`TMDB request failed: ${path} -> ${res.status}`);
    }
    return (await res.json()) as T;
  }

  static posterUrl(path: string | null | undefined): string | undefined {
    return path ? `${TMDB_IMAGE_BASE_URL}${path}` : undefined;
  }

  searchMovies(query: string, year?: number): Promise<{ results: TmdbMovieSummary[] }> {
    return this.get("/search/movie", { query, ...(year ? { year: String(year) } : {}) });
  }

  searchTv(query: string, year?: number): Promise<{ results: TmdbTvSummary[] }> {
    return this.get("/search/tv", {
      query,
      ...(year ? { first_air_date_year: String(year) } : {}),
    });
  }

  getMovie(id: string): Promise<TmdbMovieDetails> {
    return this.get(`/movie/${id}`);
  }

  getTv(id: string): Promise<TmdbTvDetails> {
    return this.get(`/tv/${id}`);
  }

  getEpisode(tvId: string, season: number, episode: number): Promise<TmdbEpisodeDetails> {
    return this.get(`/tv/${tvId}/season/${season}/episode/${episode}`);
  }
}
