import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";

export const STAGE = "virus_scan";

export async function virusScan(ctx: PipelineContext): Promise<void> {
  if (!ctx.app.virusScanner.isEnabled()) {
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "Virus scanning disabled, skipping");
    return;
  }

  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Scanning files for malware");

  const files = ctx.state.mediaFiles ?? [];
  for (const file of files) {
    const result = await ctx.app.virusScanner.scanFile(file);
    if (!result.clean) {
      throw new PipelineStageError(
        STAGE,
        `Infected file detected: "${file}" (${result.signature ?? "unknown signature"})`,
      );
    }
  }

  ctx.app.queue.updateStage(ctx.job.id, STAGE, `${files.length} file(s) scanned clean`);
}
