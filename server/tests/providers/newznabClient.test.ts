import { describe, it, expect, vi, afterEach } from "vitest";
import { NewznabClient } from "../../src/providers/download/sabnzbd/newznabClient.js";

const originalFetch = global.fetch;

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Movie.Title.2020.1080p.BluRay.x264-GROUP</title>
      <link>https://indexer.example/details/abc</link>
      <enclosure url="https://indexer.example/getnzb/abc.nzb" length="1234567890" type="application/x-nzb" />
    </item>
    <item>
      <title>Movie.Title.2020.720p.WEBRip.x264-GROUP2</title>
      <link>https://indexer.example/details/def</link>
      <enclosure url="https://indexer.example/getnzb/def.nzb" length="987654321" type="application/x-nzb" />
    </item>
  </channel>
</rss>`;

describe("NewznabClient", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses RSS items into NewznabResult objects", async () => {
    global.fetch = vi.fn(async () => new Response(SAMPLE_RSS, { status: 200 })) as unknown as typeof fetch;

    const client = new NewznabClient({ url: "https://indexer.example", apiKey: "key" });
    const results = await client.search("Movie Title");

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "Movie.Title.2020.1080p.BluRay.x264-GROUP",
      downloadUrl: "https://indexer.example/getnzb/abc.nzb",
      sizeBytes: 1234567890,
    });
  });

  it("falls back to <link> when there's no enclosure url", async () => {
    const rss = `<rss><channel><item><title>Foo</title><link>https://indexer.example/x.nzb</link></item></channel></rss>`;
    global.fetch = vi.fn(async () => new Response(rss, { status: 200 })) as unknown as typeof fetch;

    const client = new NewznabClient({ url: "https://indexer.example", apiKey: "key" });
    const results = await client.search("Foo");
    expect(results[0]!.downloadUrl).toBe("https://indexer.example/x.nzb");
  });

  it("returns an empty array when there are no results", async () => {
    const rss = `<rss><channel></channel></rss>`;
    global.fetch = vi.fn(async () => new Response(rss, { status: 200 })) as unknown as typeof fetch;

    const client = new NewznabClient({ url: "https://indexer.example", apiKey: "key" });
    expect(await client.search("nothing")).toEqual([]);
  });

  it("handles a single <item> (not wrapped in an array) from the XML parser", async () => {
    const rss = `<rss><channel><item><title>Only.One</title><enclosure url="https://x/one.nzb" length="100"/></item></channel></rss>`;
    global.fetch = vi.fn(async () => new Response(rss, { status: 200 })) as unknown as typeof fetch;

    const client = new NewznabClient({ url: "https://indexer.example", apiKey: "key" });
    const results = await client.search("Only One");
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Only.One");
  });

  it("throws a clear error on a non-OK response", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const client = new NewznabClient({ url: "https://indexer.example", apiKey: "key" });
    await expect(client.search("x")).rejects.toThrow(/Newznab search failed/);
  });
});
