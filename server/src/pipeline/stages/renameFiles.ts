import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { computeDestinationPath } from "../../services/organization/organizer.js";

export const STAGE = "rename_files";

export async function renameFiles(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Computing target filename");

  const { primaryMediaFile, metadata } = ctx.state;
  const mediaType = ctx.job.mediaType;
  if (!primaryMediaFile || !metadata || !mediaType) {
    throw new PipelineStageError(STAGE, "Missing media file, metadata, or media type before renaming");
  }

  const destinationPath = await computeDestinationPath({
    sourceFilePath: primaryMediaFile,
    mediaType,
    metadata,
    namingTemplates: ctx.app.config.naming,
    libraryDirs: ctx.app.config.storage.libraryDirs,
  });

  ctx.state.destinationPath = destinationPath;
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Target: ${destinationPath}`);
}
