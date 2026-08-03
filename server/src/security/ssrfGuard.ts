import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SsrfError extends Error {}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_IPV4_RANGES: [string, string][] = [
  ["0.0.0.0", "0.255.255.255"],
  ["10.0.0.0", "10.255.255.255"],
  ["100.64.0.0", "100.127.255.255"], // carrier-grade NAT
  ["127.0.0.0", "127.255.255.255"], // loopback
  ["169.254.0.0", "169.254.255.255"], // link-local (also the cloud metadata endpoint range)
  ["172.16.0.0", "172.31.255.255"],
  ["192.0.0.0", "192.0.0.255"],
  ["192.168.0.0", "192.168.255.255"],
  ["198.18.0.0", "198.19.255.255"],
  ["224.0.0.0", "255.255.255.255"], // multicast/reserved
];

function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= ipv4ToInt(start) && value <= ipv4ToInt(end));
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

/**
 * Blocks outbound fetches to loopback/private/link-local addresses (including the common cloud
 * metadata endpoint range) and non-http(s) protocols. Required before fetching any URL that
 * ultimately comes from user or third-party input (release names, search results) — otherwise
 * a crafted request could make the server fetch its own internal network on the caller's behalf.
 */
export async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Unsupported protocol "${url.protocol}" — only http/https URLs are allowed`);
  }

  // URL.hostname keeps the enclosing brackets for IPv6 literals (e.g. "[::1]"), which isIP()
  // doesn't recognize — strip them before checking whether the host is a literal IP address.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (hostname === "localhost") {
    throw new SsrfError("Refusing to fetch localhost");
  }

  const ipVersion = isIP(hostname);
  const addresses = ipVersion
    ? [{ address: hostname, family: ipVersion }]
    : await lookup(hostname, { all: true });

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new SsrfError(`Refusing to fetch private/internal address "${address}"`);
    }
    if (family === 6 && isPrivateIPv6(address)) {
      throw new SsrfError(`Refusing to fetch private/internal address "${address}"`);
    }
  }
}
