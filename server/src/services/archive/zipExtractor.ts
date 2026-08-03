import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import AdmZip from "adm-zip";
import type { ArchiveExtractor } from "./types.js";
import { resolveWithinRoot } from "../../security/pathSanitizer.js";
import { sanitizeRelativePath } from "../../security/filenameSanitizer.js";

export class ZipExtractor implements ArchiveExtractor {
  readonly extensions = [".zip"];

  async extract(archivePath: string, destinationDir: string): Promise<string[]> {
    const zip = new AdmZip(archivePath);
    mkdirSync(destinationDir, { recursive: true });

    const extracted: string[] = [];
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      // Guard against zip-slip: sanitize each path segment and re-verify it stays in destinationDir.
      const safeName = sanitizeRelativePath(entry.entryName);
      const targetPath = resolveWithinRoot(destinationDir, safeName);
      mkdirSync(join(targetPath, ".."), { recursive: true });
      writeFileSync(targetPath, entry.getData());
      extracted.push(targetPath);
    }
    return extracted;
  }
}
