import { rm, readdir, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("cleanup");

export function jobTempDir(downloadTempDir: string, jobId: string): string {
  return join(downloadTempDir, jobId);
}

export async function ensureJobTempDir(downloadTempDir: string, jobId: string): Promise<string> {
  const dir = jobTempDir(downloadTempDir, jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupJobTempDir(downloadTempDir: string, jobId: string): Promise<void> {
  const dir = jobTempDir(downloadTempDir, jobId);
  try {
    await rm(dir, { recursive: true, force: true });
    log.debug({ jobId, dir }, "cleaned up temp directory");
  } catch (err) {
    log.warn({ jobId, dir, err: err instanceof Error ? err.message : err }, "failed to clean up temp directory");
  }
}

/** Recursively sums file sizes under `dir`. Used for the storage-usage stats endpoint. */
export async function directorySizeBytes(dir: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySizeBytes(full);
    } else {
      try {
        total += (await stat(full)).size;
      } catch {
        // File may have been removed concurrently; skip.
      }
    }
  }
  return total;
}
