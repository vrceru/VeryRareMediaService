import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { computeDestinationPaths } from "../../services/organization/organizer.js";

export const STAGE = "rename_files";

export async function renameFiles(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Computing target filename(s)");

  const { primaryMediaFile, metadata, mediaFiles } = ctx.state;
  const mediaType = ctx.job.mediaType;
  if (!primaryMediaFile || !metadata || !mediaType) {
    throw new PipelineStageError(STAGE, "Missing media file, metadata, or media type before renaming");
  }

  // A batch release (e.g. a full anime/show season pack) has more than one valid media file --
  // validateMedia.ts keeps all of them in `mediaFiles`, not just the largest ("primary") one.
  // Compute a destination for every file so organizeLibrary can file the whole season, not just
  // the one episode that happened to be biggest.
  const files = mediaFiles && mediaFiles.length > 0 ? mediaFiles : [primaryMediaFile];
  const destinationPaths = await computeDestinationPaths({
    sourceFilePaths: files,
    mediaType,
    metadata,
    namingTemplates: ctx.app.config.naming,
    libraryDirs: ctx.app.config.storage.libraryDirs,
  });
  ctx.state.destinationPaths = destinationPaths;

  const primaryEntry = destinationPaths.find((d) => d.source === primaryMediaFile) ?? destinationPaths[0]!;
  ctx.state.destinationPath = primaryEntry.destination;

  ctx.app.queue.updateStage(
    ctx.job.id,
    STAGE,
    files.length > 1
      ? `Target: ${files.length} files (e.g. ${primaryEntry.destination})`
      : `Target: ${primaryEntry.destination}`,
  );
}
