import type { PipelineContext } from "../types.js";
import { saveArtworkIfMissing } from "../../services/artwork/artwork.js";

export const STAGE = "generate_artwork";

export async function generateArtwork(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Fetching artwork");

  const { organizedItemDir, metadata } = ctx.state;
  if (!organizedItemDir) {
    ctx.app.queue.updateStage(ctx.job.id, STAGE, "No organized directory, skipping artwork");
    return;
  }

  const saved = await saveArtworkIfMissing(organizedItemDir, metadata?.posterUrl);
  ctx.app.queue.updateStage(
    ctx.job.id,
    STAGE,
    saved ? `Saved artwork to ${saved}` : "No artwork available from metadata provider",
  );
}
