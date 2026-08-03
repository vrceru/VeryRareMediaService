import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";

export const STAGE = "verify_download";

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

export async function verifyDownload(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Verifying downloaded files");

  const dir = ctx.state.downloadSavePath ?? ctx.state.tempDir;
  if (!dir) {
    throw new PipelineStageError(STAGE, "No download directory recorded");
  }

  const files = await listFilesRecursive(dir);
  if (files.length === 0) {
    throw new PipelineStageError(STAGE, "Download produced no files");
  }

  for (const file of files) {
    const s = await stat(file);
    if (s.size === 0) {
      throw new PipelineStageError(STAGE, `Downloaded file "${file}" is empty`);
    }
  }

  ctx.state.mediaFiles = files;
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Verified ${files.length} file(s)`);
}
