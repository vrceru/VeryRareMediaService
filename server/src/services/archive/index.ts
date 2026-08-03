import { extname } from "node:path";
import type { ArchiveExtractor } from "./types.js";
import { ZipExtractor } from "./zipExtractor.js";
import { RarExtractor } from "./rarExtractor.js";

export type { ArchiveExtractor } from "./types.js";

const extractors: ArchiveExtractor[] = [new ZipExtractor(), new RarExtractor()];

export function isArchive(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return extractors.some((e) => e.extensions.includes(ext));
}

/** Extracts an archive into destinationDir using the first extractor that handles its extension. */
export async function extractArchive(archivePath: string, destinationDir: string): Promise<string[]> {
  const ext = extname(archivePath).toLowerCase();
  const extractor = extractors.find((e) => e.extensions.includes(ext));
  if (!extractor) {
    throw new Error(
      `No archive extractor registered for "${ext}" files. Only .zip and .rar are supported ` +
        `currently — add another ArchiveExtractor implementation to services/archive to support more.`,
    );
  }
  return extractor.extract(archivePath, destinationDir);
}
