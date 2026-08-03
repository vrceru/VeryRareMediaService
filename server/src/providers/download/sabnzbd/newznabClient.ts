import { XMLParser } from "fast-xml-parser";

export interface NewznabConfig {
  url: string;
  apiKey: string;
}

export interface NewznabResult {
  title: string;
  downloadUrl: string;
  sizeBytes: number;
}

interface RssEnclosure {
  "@_url"?: string;
  "@_length"?: string;
}

interface RssItem {
  title?: string;
  link?: string;
  enclosure?: RssEnclosure;
}

interface RssDocument {
  rss?: {
    channel?: {
      item?: RssItem | RssItem[];
    };
  };
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Client for Newznab-compatible usenet indexers (the search layer SABnzbd itself doesn't
 * provide — SABnzbd only adds/downloads/tracks NZBs, it can't find them). Uses the standard
 * `t=search` RSS/XML endpoint most indexers (NZBGeek, NZBFinder, etc.) implement.
 */
export class NewznabClient {
  constructor(private readonly config: NewznabConfig) {}

  async search(query: string): Promise<NewznabResult[]> {
    const url = new URL(`${this.config.url}/api`);
    url.searchParams.set("t", "search");
    url.searchParams.set("q", query);
    url.searchParams.set("apikey", this.config.apiKey);
    url.searchParams.set("o", "xml");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Newznab search failed: ${res.status}`);
    }
    const xml = await res.text();
    const doc = parser.parse(xml) as RssDocument;

    const rawItems = doc.rss?.channel?.item;
    if (!rawItems) return [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    return items
      .map((item): NewznabResult | undefined => {
        const title = item.title;
        const downloadUrl = item.enclosure?.["@_url"] ?? item.link;
        if (!title || !downloadUrl) return undefined;
        const sizeBytes = item.enclosure?.["@_length"] ? Number(item.enclosure["@_length"]) : 0;
        return { title, downloadUrl, sizeBytes };
      })
      .filter((r): r is NewznabResult => r !== undefined);
  }
}
