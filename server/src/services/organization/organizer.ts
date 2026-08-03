import { mkdir, rename, copyFile, unlink, access } from "node:fs/promises";
import { dirname, extname, join, basename } from "node:path";
import type { MediaMetadata } from "../../providers/metadata/types.js";
import type { MediaType } from "../../db/schema.js";
import { renderTemplate } from "../naming/templateEngine.js";
import { buildNamingTokens } from "../naming/buildNamingTokens.js";
import { sanitizeRelativePath } from "../../security/filenameSanitizer.js";
import { resolveWithinRoot } from "../../security/pathSanitizer.js";

export interface NamingTemplates {
  movie: string;
  show: string;
  anime: string;
  music: string;
}

export interface LibraryDirs {
  movie: string;
  show: string;
  anime: string;
  music: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Appends " (1)", " (2)", ... before the extension until an unused path is found. */
async function resolveUniquePath(candidatePath: string): Promise<string> {
  if (!(await fileExists(candidatePath))) return candidatePath;

  const ext = extname(candidatePath);
  const dir = dirname(candidatePath);
  const base = basename(candidatePath, ext);

  let n = 1;
  while (true) {
    const attempt = join(dir, `${base} (${n})${ext}`);
    if (!(await fileExists(attempt))) return attempt;
    n++;
  }
}

/**
 * Computes (but does not create) the final library destination for a media file: applies the
 * naming template, sanitizes it, guards it against escaping the library root, and resolves
 * name collisions against files that already exist on disk.
 */
export async function computeDestinationPath(params: {
  sourceFilePath: string;
  mediaType: MediaType;
  metadata: MediaMetadata;
  namingTemplates: NamingTemplates;
  libraryDirs: LibraryDirs;
}): Promise<string> {
  const { sourceFilePath, mediaType, metadata, namingTemplates, libraryDirs } = params;

  const template = namingTemplates[mediaType];
  const libraryRoot = libraryDirs[mediaType];
  const tokens = buildNamingTokens(metadata, extname(sourceFilePath));
  const relativePath = sanitizeRelativePath(renderTemplate(template, tokens));

  const rawDestPath = resolveWithinRoot(libraryRoot, relativePath);
  return resolveUniquePath(rawDestPath);
}

/** Moves sourceFilePath to destPath, creating parent directories as needed. */
export async function moveToDestination(sourceFilePath: string, destPath: string): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  try {
    await rename(sourceFilePath, destPath);
  } catch (err) {
    // EXDEV: source and destination are on different filesystems/drives — fall back to copy+delete.
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await copyFile(sourceFilePath, destPath);
      await unlink(sourceFilePath);
    } else {
      throw err;
    }
  }
}

/** Convenience helper combining compute + move for callers (e.g. tests) that don't need the
 * two-step split the pipeline uses (separate "rename" and "organize" stages). */
export async function organizeFile(params: {
  sourceFilePath: string;
  mediaType: MediaType;
  metadata: MediaMetadata;
  namingTemplates: NamingTemplates;
  libraryDirs: LibraryDirs;
}): Promise<string> {
  const destPath = await computeDestinationPath(params);
  await moveToDestination(params.sourceFilePath, destPath);
  return destPath;
}
