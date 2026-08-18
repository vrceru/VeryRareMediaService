import type { AppConfig } from "../../config/index.js";
import type { DownloadProvider } from "./types.js";
import { QbittorrentProvider } from "./qbittorrent/provider.js";
import { SabnzbdProvider } from "./sabnzbd/provider.js";
import { DirectDownloadProvider } from "./directDownload/provider.js";
import { YoutubeProvider } from "./youtube/provider.js";

export class DownloadProviderRegistry {
  private readonly providers = new Map<string, DownloadProvider>();

  constructor(config: AppConfig) {
    this.register(new QbittorrentProvider(config.qbittorrent));
    this.register(new SabnzbdProvider(config.sabnzbd, config.newznab));
    this.register(new DirectDownloadProvider());
    this.register(new YoutubeProvider(config.youtube));
  }

  private register(provider: DownloadProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): DownloadProvider | undefined {
    return this.providers.get(id);
  }

  list(): DownloadProvider[] {
    return [...this.providers.values()];
  }

  /** Providers that are actually usable right now (credentials/config present). */
  listConfigured(): DownloadProvider[] {
    return this.list().filter((p) => p.isConfigured());
  }
}
