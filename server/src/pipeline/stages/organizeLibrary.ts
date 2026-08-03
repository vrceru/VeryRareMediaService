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

  // destinationPaths covers every file in a batch (season-pack) release; fall back to the
  // single primary file/path pair when it's absent (movies, music, or a hand-built context that
  // skips renameFiles, as in tests).
  const pairs = ctx.state.destinationPaths?.length
    ? ctx.state.destinationPaths
    : [{ source: primaryMediaFile, destination: destinationPath }];

  const libraryRoot = ctx.app.config.storage.libraryDirs[mediaType];
  await mkdir(libraryRoot, { recursive: true });

  let organizedItemDir = dirname(destinationPath);
  let totalBytes = 0;
  const toMove: { source: string; destination: string }[] = [];

  for (const pair of pairs) {
    const duplicate = await findDuplicate(pair.source, libraryRoot).catch(() => undefined);
    if (duplicate) {
      ctx.app.queue.updateStage(ctx.job.id, STAGE, `Duplicate of existing file "${duplicate}" — skipping ${pair.source}`);
      if (pair.source === primaryMediaFile) organizedItemDir = dirname(duplicate);
      continue;
    }
    toMove.push(pair);
    totalBytes += (await stat(pair.source)).size;
  }

  if (toMove.length === 0) {
    ctx.state.organizedItemDir = organizedItemDir;
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "All file(s) already present in the library");
    return;
  }

  // Hard safety net: even if an admin approved final review without noticing a storage
  // warning (see GET /api/approvals/final), never move files onto a destination that
  // doesn't actually have room for them.
  const space = await checkSpace(libraryRoot, totalBytes);
  if (!space.hasEnoughSpace) {
    throw new PipelineStageError(
      STAGE,
      `Not enough free space at "${libraryRoot}": need ${totalBytes} bytes, only ${space.freeBytes} available`,
    );
  }

  for (const pair of toMove) {
    await moveToDestination(pair.source, pair.destination);
  }
  const primaryMove = toMove.find((p) => p.source === primaryMediaFile) ?? toMove[0]!;
  organizedItemDir = dirname(primaryMove.destination);

  ctx.state.organizedItemDir = organizedItemDir;
  ctx.app.queue.updateStage(
    ctx.job.id,
    STAGE,
    toMove.length > 1 ? `Moved ${toMove.length} files into ${organizedItemDir}` : `Moved to ${primaryMove.destination}`,
  );
}
