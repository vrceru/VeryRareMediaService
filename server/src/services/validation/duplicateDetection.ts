import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { sha256File } from "../checksum/checksum.js";

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * Scans `libraryDir` for a file matching `candidatePath` by size first (cheap), then SHA-256
 * (only computed when sizes match) to confirm. Returns the path of the duplicate if found.
 */
export async function findDuplicate(
  candidatePath: string,
  libraryDir: string,
): Promise<string | undefined> {
  const candidateStat = await stat(candidatePath);
  const candidateSize = candidateStat.size;

  const files = await walk(libraryDir);
  const sameSizeFiles: string[] = [];
  for (const file of files) {
    const s = await stat(file);
    if (s.size === candidateSize) sameSizeFiles.push(file);
  }
  if (sameSizeFiles.length === 0) return undefined;

  const candidateHash = await sha256File(candidatePath);
  for (const file of sameSizeFiles) {
    const hash = await sha256File(file);
    if (hash === candidateHash) return file;
  }
  return undefined;
}
