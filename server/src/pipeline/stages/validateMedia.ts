import { stat } from "node:fs/promises";
import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { validateMediaFile } from "../../services/validation/mediaValidator.js";

export const STAGE = "validate_media";

export async function validateMedia(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Validating media files");

  const candidates = ctx.state.mediaFiles ?? [];
  const valid = candidates.filter((f) => validateMediaFile(f).valid);

  if (valid.length === 0) {
    throw new PipelineStageError(STAGE, "No valid media files found after validation");
  }

  // Primary file = the largest valid file (typical heuristic for "the actual episode/movie").
  const sizes = await Promise.all(valid.map(async (f) => ({ f, size: (await stat(f)).size })));
  sizes.sort((a, b) => b.size - a.size);

  ctx.state.mediaFiles = valid;
  ctx.state.primaryMediaFile = sizes[0]!.f;
  ctx.app.queue.setPrimaryMediaFile(ctx.job.id, sizes[0]!.f);
  ctx.app.queue.setMediaFiles(ctx.job.id, valid);
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `${valid.length} valid file(s), primary: ${sizes[0]!.f}`);
}
