export interface SabnzbdConfig {
  url: string;
  apiKey: string;
}

export interface SabQueueSlot {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: string;
  mb: string;
  mbleft: string;
}

export interface SabQueueResponse {
  queue: {
    kbpersec: string;
    slots: SabQueueSlot[];
  };
}

export interface SabHistorySlot {
  nzo_id: string;
  name: string;
  status: string;
  storage: string;
  fail_message: string;
}

export interface SabHistoryResponse {
  history: {
    slots: SabHistorySlot[];
  };
}

/** Thin wrapper over the SABnzbd Web API (https://sabnzbd.org/wiki/advanced/api). */
export class SabnzbdClient {
  constructor(private readonly config: SabnzbdConfig) {}

  private async call<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.url}/api`);
    url.searchParams.set("apikey", this.config.apiKey);
    url.searchParams.set("output", "json");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`SABnzbd request failed: mode=${params.mode} -> ${res.status}`);
    }
    return (await res.json()) as T;
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.call<{ version: string }>({ mode: "version" });
      return typeof res.version === "string";
    } catch {
      return false;
    }
  }

  /** Adds an NZB by URL. Returns the resulting nzo_id. SABnzbd has no per-job "save to this
   * exact folder" option for URL adds — the file lands in whatever the category's configured
   * completed-download folder is, and history.storage reports where once it's done. */
  async addUrl(nzbUrl: string, displayName: string): Promise<string> {
    const result = await this.call<{ status: boolean; nzo_ids?: string[]; error?: string }>({
      mode: "addurl",
      name: nzbUrl,
      nzbname: displayName,
    });
    if (!result.status || !result.nzo_ids?.[0]) {
      throw new Error(`SABnzbd rejected the NZB: ${result.error ?? "unknown error"}`);
    }
    return result.nzo_ids[0];
  }

  async getQueue(): Promise<SabQueueResponse> {
    return this.call<SabQueueResponse>({ mode: "queue" });
  }

  async getHistory(limit = 50): Promise<SabHistoryResponse> {
    return this.call<SabHistoryResponse>({ mode: "history", limit: String(limit) });
  }

  async deleteFromQueue(nzoId: string, deleteFiles: boolean): Promise<void> {
    await this.call({ mode: "queue", name: "delete", value: nzoId, del_files: deleteFiles ? "1" : "0" });
  }
}
