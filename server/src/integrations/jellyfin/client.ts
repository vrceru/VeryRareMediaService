import { getLogger } from "../../logging/logger.js";

const log = getLogger("jellyfin");

export interface JellyfinConfig {
  url: string;
  apiKey: string;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Path?: string;
  Type: string;
}

/** Thin wrapper over the Jellyfin REST API (https://api.jellyfin.org). Server details always
 * come from config — never hardcoded. */
export class JellyfinClient {
  constructor(private readonly config: JellyfinConfig) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("X-Emby-Token", this.config.apiKey);
    if (init.body) headers.set("Content-Type", "application/json");

    const res = await fetch(`${this.config.url}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new Error(`Jellyfin request failed: ${init.method ?? "GET"} ${path} -> ${res.status}`);
    }
    return res;
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.request("/System/Ping");
      return res.ok;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, "jellyfin connection test failed");
      return false;
    }
  }

  /** Triggers a full library scan. Prefer notifyPathUpdated for targeted, faster updates. */
  async refreshLibrary(): Promise<void> {
    await this.request("/Library/Refresh", { method: "POST" });
    log.info("jellyfin full library refresh triggered");
  }

  /** Tells Jellyfin a specific path was created/updated/deleted, avoiding a full rescan. */
  async notifyPathUpdated(path: string, updateType: "Created" | "Modified" | "Deleted" = "Created"): Promise<void> {
    await this.request("/Library/Media/Updated", {
      method: "POST",
      body: JSON.stringify({ Updates: [{ Path: path, UpdateType: updateType }] }),
    });
    log.info({ path, updateType }, "jellyfin notified of path update");
  }

  async findItemByPath(path: string): Promise<JellyfinItem | undefined> {
    const url = `/Items?searchTerm=${encodeURIComponent(path)}&Recursive=true&Limit=1`;
    const res = await this.request(url);
    const data = (await res.json()) as { Items: JellyfinItem[] };
    return data.Items[0];
  }

  /** Sends a notification banner to Jellyfin admin users (POST /Notifications/Admin). */
  async notifyAdmins(name: string, description: string): Promise<void> {
    await this.request("/Notifications/Admin", {
      method: "POST",
      body: JSON.stringify({ Name: name, Description: description, Date: new Date().toISOString() }),
    });
  }
}
