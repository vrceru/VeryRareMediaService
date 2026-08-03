import { dirname } from "node:path";
import { mkdir, stat } from "node:fs/promises";
import type { PipelineContext } from "../types.js";
import { PipelineStageError } from "../types.js";
import { moveToDestination } from "../../services/organization/organizer.js";
import { findDuplicate } from "../../services/validation/duplicateDetection.js";
import { checkSpace } from "../../services/storage/diskSpace.js";

export const STAGE = "organize_library";

export async function organizeLibrary(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Organizing into library");

  const { primaryMediaFile, destinationPath } = ctx.state;
  const mediaType = ctx.job.mediaType;
  if (!primaryMediaFile || !destinationPath || !mediaType) {
    throw new PipelineStageError(STAGE, "Missing file/destination before organizing");
  }

  const libraryRoot = ctx.app.config.storage.libraryDirs[mediaType];
  const duplicate = await findDuplicate(primaryMediaFile, libraryRoot).catch(() => undefined);
  if (duplicate) {
    ctx.app.queue.updateStage(ctx.job.id, STAGE, `Duplicate of existing file "${duplicate}" — skipping move`);
    ctx.state.organizedItemDir = dirname(duplicate);
    return;
  }

  // Hard safety net: even if an admin approved final review without noticing a storage
  // warning (see GET /api/approvals/final), never move a file onto a destination that
  // doesn't actually have room for it.
  await mkdir(libraryRoot, { recursive: true });
  const fileSize = (await stat(primaryMediaFile)).size;
  const space = await checkSpace(libraryRoot, fileSize);
  if (!space.hasEnoughSpace) {
    throw new PipelineStageError(
      STAGE,
      `Not enough free space at "${libraryRoot}": need ${fileSize} bytes, only ${space.freeBytes} available`,
    );
  }

  await moveToDestination(primaryMediaFile, destinationPath);
  ctx.state.organizedItemDir = dirname(destinationPath);
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Moved to ${destinationPath}`);
}
