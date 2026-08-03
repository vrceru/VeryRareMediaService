export interface ParsedRelease {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeEnd?: number;
  /** Canonical lowercase key, e.g. "1080p", "2160p". */
  resolution?: string;
  /** Canonical lowercase key, e.g. "bluray", "webdl", "webrip", "hdtv", "dvd", "cam". */
  source?: string;
  /** Canonical lowercase key, e.g. "hevc", "avc", "av1", "xvid". */
  codec?: string;
  /** Canonical lowercase key, e.g. "dts", "truehd", "ddp", "aac", "flac". */
  audioCodec?: string;
  releaseGroup?: string;
  /** How the release group was found — a leading "[Group]" prefix is the anime/fansub
   * convention and is a useful signal for media-type detection. */
  groupStyle?: "prefix" | "suffix";
  isProper: boolean;
  isRepack: boolean;
}
