import type { MediaMetadata } from "../../providers/metadata/types.js";
import type { NamingTokens } from "./templateEngine.js";
import { pad2 } from "./templateEngine.js";

export function buildNamingTokens(metadata: MediaMetadata, fileExtension: string): NamingTokens {
  return {
    title: metadata.title,
    year: metadata.year,
    extension: fileExtension.startsWith(".") ? fileExtension : `.${fileExtension}`,
    season: metadata.season,
    seasonPadded: pad2(metadata.season),
    episode: metadata.episode,
    episodePadded: pad2(metadata.episode),
    episodeTitle: metadata.episodeTitle,
    artist: metadata.artist,
    album: metadata.album,
    track: metadata.trackNumber,
    trackPadded: pad2(metadata.trackNumber),
  };
}
