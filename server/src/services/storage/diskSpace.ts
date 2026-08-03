import { statfs } from "node:fs/promises";

/** Free bytes available at (or above) the given path. Verified working cross-platform
 * (including Windows) on the Node version this project targets. */
export async function getFreeBytes(path: string): Promise<number> {
  const stats = await statfs(path);
  return stats.bavail * stats.bsize;
}

export interface SpaceCheck {
  freeBytes: number;
  requiredBytes: number;
  hasEnoughSpace: boolean;
}

export async function checkSpace(path: string, requiredBytes: number): Promise<SpaceCheck> {
  const freeBytes = await getFreeBytes(path);
  return { freeBytes, requiredBytes, hasEnoughSpace: freeBytes >= requiredBytes };
}
