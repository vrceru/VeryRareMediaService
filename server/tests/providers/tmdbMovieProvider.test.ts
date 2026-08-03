import { describe, it, expect, vi, afterEach } from "vitest";
import { TmdbMovieProvider } from "../../src/providers/metadata/tmdb/movieProvider.js";

const originalFetch = global.fetch;

describe("TmdbMovieProvider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reports not configured when no API key is provided", () => {
    const provider = new TmdbMovieProvider(undefined);
    expect(provider.isConfigured()).toBe(false);
  });

  it("throws a clear error when searching without an API key", async () => {
    const provider = new TmdbMovieProvider(undefined);
    await expect(provider.search("Inception")).rejects.toThrow(/not configured/);
  });

  it("maps TMDB search results into MetadataSearchResult", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: 27205,
              title: "Inception",
              release_date: "2010-07-15",
              overview: "A thief who steals corporate secrets...",
              poster_path: "/poster.jpg",
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const provider = new TmdbMovieProvider("fake-key");
    const results = await provider.search("Inception");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      externalId: "27205",
      title: "Inception",
      year: 2010,
      posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
    });
  });

  it("propagates a clear error on non-OK responses", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const provider = new TmdbMovieProvider("fake-key");
    await expect(provider.search("X")).rejects.toThrow(/TMDB request failed/);
  });
});
