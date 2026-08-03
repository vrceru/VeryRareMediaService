import { extname } from "node:path";
import type { PipelineContext } from "../types.js";
import type { MediaType } from "../../db/schema.js";
import type { ParsedRelease } from "../../services/releaseParsing/types.js";
import { AUDIO_EXTENSIONS } from "../../services/validation/mediaValidator.js";

export const STAGE = "identify_media";

const EPISODE_PATTERN = /\bS\d{1,2}E\d{1,3}\b/i;
const ANIME_HINT_PATTERN = /\b(anime|fansub|\[[^\]]*sub[^\]]*\])\b/i;

/**
 * Determines the media type for a job. If the request explicitly specified one, that wins.
 * Otherwise falls back to heuristics, preferring the structured signal from the parsed
 * release (selectRelease's ParsedRelease) over raw title regexes when available: an audio
 * file implies music, a leading "[Group]" bracket (the anime/fansub naming convention) or an
 * anime-hint keyword implies anime, a parsed or regex-matched season/episode implies a show,
 * and everything else defaults to movie.
 */
function guessMediaType(title: string, primaryFile: string | undefined, parsed: ParsedRelease | undefined): MediaType {
  if (primaryFile && AUDIO_EXTENSIONS.includes(extname(primaryFile).toLowerCase())) {
    return "music";
  }
  if (parsed?.groupStyle === "prefix" || ANIME_HINT_PATTERN.test(title)) {
    return "anime";
  }
  if ((parsed?.season !== undefined && parsed?.episode !== undefined) || EPISODE_PATTERN.test(title)) {
    return "show";
  }
  return "movie";
}

export async function identifyMedia(ctx: PipelineContext): Promise<void> {
  ctx.app.queue.updateStage(ctx.job.id, STAGE, "Identifying media type");

  const requested = ctx.job.request.mediaType;
  const guessed = guessMediaType(ctx.job.title, ctx.state.primaryMediaFile, ctx.state.parsedRelease);
  // TMDB (what the Discord bot's request search uses) has no "anime" category, so anime
  // requests always arrive tagged "show" — let the heuristic upgrade that once the actual
  // release is visible. Any other explicit request type (movie/anime/music) stays authoritative.
  const mediaType = requested === "show" && guessed === "anime" ? "anime" : (requested ?? guessed);

  ctx.job.mediaType = mediaType;
  ctx.app.queue.setMediaType(ctx.job.id, mediaType);
  ctx.app.queue.updateStage(ctx.job.id, STAGE, `Identified as "${mediaType}"`);
}
