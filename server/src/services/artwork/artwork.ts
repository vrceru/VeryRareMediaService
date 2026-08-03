import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("artwork");

/**
 * Downloads the provider's poster image into the item's folder as `folder.jpg`, which Jellyfin
 * (and Kodi/Plex) recognize automatically. No local placeholder-image generation is implemented
 * — if the metadata provider has no artwork, the folder is left without one and Jellyfin's own
 * metadata fetchers can fill it in later.
 */
export async function saveArtworkIfMissing(
  itemDir: string,
  posterUrl: string | undefined,
): Promise<string | undefined> {
  if (!posterUrl) return undefined;

  try {
    const res = await fetch(posterUrl);
    if (!res.ok) {
      log.warn({ posterUrl, status: res.status }, "artwork download failed");
      return undefined;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const destPath = join(itemDir, "folder.jpg");
    await writeFile(destPath, buffer);
    return destPath;
  } catch (err) {
    log.warn({ posterUrl, err: err instanceof Error ? err.message : err }, "artwork fetch error");
    return undefined;
  }
}
