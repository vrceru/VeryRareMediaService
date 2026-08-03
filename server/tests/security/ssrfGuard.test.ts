import { describe, it, expect, vi, afterEach } from "vitest";
import { assertPublicHttpUrl, SsrfError } from "../../src/security/ssrfGuard.js";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

describe("assertPublicHttpUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(assertPublicHttpUrl(new URL("ftp://example.com/file"))).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl(new URL("file:///etc/passwd"))).rejects.toThrow(SsrfError);
  });

  it("rejects the literal 'localhost' hostname without needing DNS", async () => {
    await expect(assertPublicHttpUrl(new URL("http://localhost/x"))).rejects.toThrow(SsrfError);
  });

  it("rejects literal loopback and private IPv4 addresses directly (no DNS lookup needed)", async () => {
    await expect(assertPublicHttpUrl(new URL("http://127.0.0.1/x"))).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl(new URL("http://10.0.0.5/x"))).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl(new URL("http://192.168.1.1/x"))).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl(new URL("http://172.16.0.1/x"))).rejects.toThrow(SsrfError);
  });

  it("rejects the cloud metadata endpoint address (169.254.169.254)", async () => {
    await expect(assertPublicHttpUrl(new URL("http://169.254.169.254/latest/meta-data"))).rejects.toThrow(
      SsrfError,
    );
  });

  it("rejects a literal loopback IPv6 address", async () => {
    await expect(assertPublicHttpUrl(new URL("http://[::1]/x"))).rejects.toThrow(SsrfError);
  });

  it("allows a public IPv4 address directly", async () => {
    await expect(assertPublicHttpUrl(new URL("http://93.184.216.34/x"))).resolves.toBeUndefined();
  });

  it("rejects a hostname that resolves to a private address", async () => {
    const { lookup } = await import("node:dns/promises");
    vi.mocked(lookup).mockResolvedValue([{ address: "10.1.2.3", family: 4 }] as never);
    await expect(assertPublicHttpUrl(new URL("http://internal.example.com/x"))).rejects.toThrow(SsrfError);
  });

  it("allows a hostname that resolves to a public address", async () => {
    const { lookup } = await import("node:dns/promises");
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    await expect(assertPublicHttpUrl(new URL("http://example.com/x"))).resolves.toBeUndefined();
  });
});
