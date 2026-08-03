import { dirname, join } from "node:path";
import type { PipelineContext } from "../types.js";
import { isArchive, extractArchive as extract } from "../../services/archive/index.js";

export const STAGE = "extract_archive";

export async function extractArchive(ctx: PipelineContext): Promise<void> {
  const files = ctx.state.mediaFiles ?? [];
  const archives = files.filter(isArchive);

  if (archives.length === 0) {
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "No archives to extract");
    return;
  }

  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Extracting ${archives.length} archive(s)`);

  const nonArchives = files.filter((f) => !archives.includes(f));
  const extracted: string[] = [];
  for (const archive of archives) {
    const destDir = join(dirname(archive), "extracted");
    extracted.push(...(await extract(archive, destDir)));
  }

  ctx.state.mediaFiles = [...nonArchives, ...extracted];
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Extracted ${extracted.length} file(s)`);
}
