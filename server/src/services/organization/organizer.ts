import { mkdir, rename, copyFile, unlink, access } from "node:fs/promises";
import { dirname, extname, join, basename } from "node:path";
import type { MediaMetadata } from "../../providers/metadata/types.js";
import type { MediaType } from "../../db/schema.js";
import { renderTemplate } from "../naming/templateEngine.js";
import { buildNamingTokens } from "../naming/buildNamingTokens.js";
import { sanitizeRelativePath } from "../../security/filenameSanitizer.js";
import { resolveWithinRoot } from "../../security/pathSanitizer.js";
import { parseReleaseName } from "../releaseParsing/releaseParser.js";

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

/** Appends " (1)", " (2)", ... before the extension until an unused path is found. `reserved`
 * additionally tracks paths already claimed earlier in the same batch, which won't exist on
 * disk yet since nothing has been moved there. */
async function resolveUniquePath(candidatePath: string, reserved: Set<string>): Promise<string> {
  if (!(await fileExists(candidatePath)) && !reserved.has(candidatePath)) {
    reserved.add(candidatePath);
    return candidatePath;
  }

  const ext = extname(candidatePath);
  const dir = dirname(candidatePath);
  const base = basename(candidatePath, ext);

  let n = 1;
  while (true) {
    const attempt = join(dir, `${base} (${n})${ext}`);
    if (!(await fileExists(attempt)) && !reserved.has(attempt)) {
      reserved.add(attempt);
      return attempt;
    }
    n++;
  }
}

/**
 * A batch release (e.g. a full anime/show season pack) has one file per episode, but
 * fetchMetadata.ts only ever looks up series-level metadata (there's no single "the" episode to
 * ask a metadata provider about ahead of time). Parse each file's own name for its season/
 * episode — the same heuristics selectRelease already applies to the overall release title —
 * and let that override the series-level placeholder. Season falls back to 1 when nothing on
 * either side names one (typical for absolute-numbered anime); episode is left alone if it
 * can't be determined, rather than guessed.
 */
function metadataForFile(metadata: MediaMetadata, mediaType: MediaType, sourceFilePath: string): MediaMetadata {
  if (mediaType !== "show" && mediaType !== "anime") return metadata;
  const parsed = parseReleaseName(basename(sourceFilePath));
  const season = parsed.season ?? metadata.season ?? 1;
  const episode = parsed.episode ?? metadata.episode;
  return { ...metadata, season, episode };
}

/**
 * Computes (but does not create) the final library destination for a media file: applies the
 * naming template, sanitizes it, guards it against escaping the library root, and resolves
 * name collisions against files that already exist on disk (plus, when `reserved` is passed in,
 * against other destinations already claimed in the same batch).
 */
export async function computeDestinationPath(params: {
  sourceFilePath: string;
  mediaType: MediaType;
  metadata: MediaMetadata;
  namingTemplates: NamingTemplates;
  libraryDirs: LibraryDirs;
  reserved?: Set<string>;
}): Promise<string> {
  const { sourceFilePath, mediaType, metadata, namingTemplates, libraryDirs, reserved = new Set<string>() } = params;

  const template = namingTemplates[mediaType];
  const libraryRoot = libraryDirs[mediaType];
  const tokens = buildNamingTokens(metadataForFile(metadata, mediaType, sourceFilePath), extname(sourceFilePath));
  const relativePath = sanitizeRelativePath(renderTemplate(template, tokens));

  const rawDestPath = resolveWithinRoot(libraryRoot, relativePath);
  return resolveUniquePath(rawDestPath, reserved);
}

/**
 * Computes a destination for every file in a batch release, each with its own per-file episode
 * parsed from its filename, guarding against two files landing on the same computed path within
 * the same batch (processed sequentially so each resolution sees what came before it).
 */
export async function computeDestinationPaths(params: {
  sourceFilePaths: string[];
  mediaType: MediaType;
  metadata: MediaMetadata;
  namingTemplates: NamingTemplates;
  libraryDirs: LibraryDirs;
}): Promise<{ source: string; destination: string }[]> {
  const { sourceFilePaths, ...rest } = params;
  const reserved = new Set<string>();
  const results: { source: string; destination: string }[] = [];
  for (const sourceFilePath of sourceFilePaths) {
    const destination = await computeDestinationPath({ sourceFilePath, ...rest, reserved });
    results.push({ source: sourceFilePath, destination });
  }
  return results;
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
