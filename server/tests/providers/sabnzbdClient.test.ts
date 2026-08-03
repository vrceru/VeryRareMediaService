import { describe, it, expect, vi, afterEach } from "vitest";
import { SabnzbdClient } from "../../src/providers/download/sabnzbd/client.js";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("SabnzbdClient", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("testConnection returns true when the version endpoint responds", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ version: "4.3.0" })) as unknown as typeof fetch;
    const client = new SabnzbdClient({ url: "http://localhost:8080", apiKey: "key" });
    expect(await client.testConnection()).toBe(true);
  });

  it("testConnection returns false on network failure", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const client = new SabnzbdClient({ url: "http://localhost:8080", apiKey: "key" });
    expect(await client.testConnection()).toBe(false);
  });

  it("addUrl returns the nzo_id on success", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ status: true, nzo_ids: ["SABnzbd_nzo_abc123"] }),
    ) as unknown as typeof fetch;
    const client = new SabnzbdClient({ url: "http://localhost:8080", apiKey: "key" });
    const nzoId = await client.addUrl("http://indexer/file.nzb", "My Release");
    expect(nzoId).toBe("SABnzbd_nzo_abc123");
  });

  it("addUrl throws a clear error when SABnzbd rejects the NZB", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ status: false, error: "NZB Timed out" }),
    ) as unknown as typeof fetch;
    const client = new SabnzbdClient({ url: "http://localhost:8080", apiKey: "key" });
    await expect(client.addUrl("http://indexer/file.nzb", "My Release")).rejects.toThrow(/NZB Timed out/);
  });

  it("getQueue returns parsed slots", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        queue: {
          kbpersec: "512",
          slots: [{ nzo_id: "abc", filename: "Release", status: "Downloading", percentage: "40", mb: "100", mbleft: "60" }],
        },
      }),
    ) as unknown as typeof fetch;
    const client = new SabnzbdClient({ url: "http://localhost:8080", apiKey: "key" });
    const queue = await client.getQueue();
    expect(queue.queue.slots).toHaveLength(1);
    expect(queue.queue.slots[0]!.status).toBe("Downloading");
  });

  it("getHistory returns parsed slots", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        history: {
          slots: [{ nzo_id: "abc", name: "Release", status: "Completed", storage: "/downloads/Release", fail_message: "" }],
        },
      }),
    ) as unknown as typeof fetch;
    const client = new SabnzbdClient({ url: "http://localhost:8080", apiKey: "key" });
    const history = await client.getHistory();
    expect(history.history.slots[0]!.storage).toBe("/downloads/Release");
  });
});
