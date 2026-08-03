import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";

export const STAGE = "validate_request";

export async function validateRequest(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Validating request");

  const { title, mediaType, season } = ctx.job.request;
  if (!title || title.trim().length === 0) {
    throw new PipelineStageError(STAGE, "Request title is required");
  }
  if (mediaType && !["movie", "show", "anime", "music"].includes(mediaType)) {
    throw new PipelineStageError(STAGE, `Unsupported mediaType "${mediaType}"`);
  }
  if (season !== undefined && season < 0) {
    throw new PipelineStageError(STAGE, "season must be a non-negative number");
  }
}
