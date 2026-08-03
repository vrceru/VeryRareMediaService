import { createExtractorFromFile } from "node-unrar-js";
import { mkdirSync } from "node:fs";
import type { ArchiveExtractor } from "./types.js";
import { resolveWithinRoot } from "../../security/pathSanitizer.js";
import { sanitizeRelativePath } from "../../security/filenameSanitizer.js";

/**
 * .rar extraction via node-unrar-js (WASM build of the official unrar library — no native
 * compilation step, unlike most Node RAR bindings).
 *
 * Security note: node-unrar-js's file extractor builds each output path as
 * `path.join(targetPath, filenameTransform(entryName))` with no traversal guard of its own
 * (verified against its source) — a crafted archive entry named e.g. "../../evil" would
 * escape targetPath. `filenameTransform` is exactly the hook meant for this, so every entry
 * name is run through `sanitizeRelativePath` there before node-unrar-js ever touches the
 * filesystem, the same protection ZipExtractor applies.
 */
export class RarExtractor implements ArchiveExtractor {
  readonly extensions = [".rar"];

  async extract(archivePath: string, destinationDir: string): Promise<string[]> {
    mkdirSync(destinationDir, { recursive: true });

    const extractor = await createExtractorFromFile({
      filepath: archivePath,
      targetPath: destinationDir,
      filenameTransform: (entryName) => sanitizeRelativePath(entryName),
    });

    const { files } = extractor.extract();
    const extracted: string[] = [];
    for (const file of files) {
      if (file.fileHeader.flags.directory) continue;
      const safeName = sanitizeRelativePath(file.fileHeader.name);
      extracted.push(resolveWithinRoot(destinationDir, safeName));
    }
    return extracted;
  }
}
