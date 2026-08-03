import { getLogger } from "../../../logging/logger.js";

const log = getLogger("qbittorrent-client");

export interface QbittorrentConfig {
  url: string;
  username: string;
  password: string;
}

export interface QbTorrentInfo {
  hash: string;
  state: string;
  progress: number;
  dlspeed: number;
  save_path: string;
}

export interface QbSearchResultItem {
  fileName: string;
  fileSize: number;
  fileUrl: string;
  nbSeeders: number;
  nbLeechers: number;
}

/** Thin wrapper over the qBittorrent Web API (https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API). */
export class QbittorrentClient {
  private sessionCookie: string | undefined;

  constructor(private readonly config: QbittorrentConfig) {}

  private async request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.sessionCookie) headers.set("Cookie", this.sessionCookie);

    const res = await fetch(`${this.config.url}${path}`, { ...init, headers });

    if (res.status === 403 && retry) {
      // Session expired — re-authenticate once and retry.
      await this.login();
      return this.request(path, init, false);
    }
    if (!res.ok) {
      throw new Error(`qBittorrent request failed: ${init.method ?? "GET"} ${path} -> ${res.status}`);
    }
    return res;
  }

  async login(): Promise<void> {
    const body = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
    });
    const res = await fetch(`${this.config.url}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`qBittorrent login failed with status ${res.status}`);
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("qBittorrent login did not return a session cookie — check credentials");
    }
    this.sessionCookie = setCookie.split(";")[0];
    log.debug("qbittorrent session established");
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.login();
      const res = await this.request("/api/v2/app/version");
      return res.ok;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : err }, "qbittorrent connection test failed");
      return false;
    }
  }

  async addTorrent(magnetOrUrl: string, savePath: string): Promise<void> {
    const body = new URLSearchParams({ urls: magnetOrUrl, savepath: savePath, autoTMM: "false" });
    await this.request("/api/v2/torrents/add", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  async getTorrentInfo(hash: string): Promise<QbTorrentInfo | undefined> {
    const res = await this.request(`/api/v2/torrents/info?hashes=${encodeURIComponent(hash)}`);
    const list = (await res.json()) as QbTorrentInfo[];
    return list[0];
  }

  async deleteTorrent(hash: string, deleteFiles: boolean): Promise<void> {
    const body = new URLSearchParams({ hashes: hash, deleteFiles: String(deleteFiles) });
    await this.request("/api/v2/torrents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  /** Starts a plugin-based search, polls until finished, returns results, and cleans up the search job. */
  async search(pattern: string, timeoutMs = 20000): Promise<QbSearchResultItem[]> {
    const startBody = new URLSearchParams({ pattern, plugins: "enabled", category: "all" });
    const startRes = await this.request("/api/v2/search/start", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: startBody,
    });
    const { id } = (await startRes.json()) as { id: number };

    const deadline = Date.now() + timeoutMs;
    let status = "Running";
    while (status === "Running" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      const statusRes = await this.request(`/api/v2/search/status?id=${id}`);
      const statusList = (await statusRes.json()) as { status: string }[];
      status = statusList[0]?.status ?? "Stopped";
    }

    const resultsRes = await this.request(`/api/v2/search/results?id=${id}`);
    const results = (await resultsRes.json()) as { results: QbSearchResultItem[] };

    await this.request(`/api/v2/search/delete?id=${id}`, { method: "POST" }).catch(() => undefined);

    return results.results ?? [];
  }
}
