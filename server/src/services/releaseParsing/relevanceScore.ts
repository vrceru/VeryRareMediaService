import type { ParsedRelease } from "./types.js";
import type { MediaRequest } from "../../queue/types.js";

/**
 * Scores how well a parsed release matches the original request's explicit constraints
 * (year/season/episode), on a 0-1 scale. Starts at 1 (no evidence of mismatch) and is only
 * docked when both the request and the parsed release specify a field and they disagree —
 * absence of information is never treated as a mismatch.
 */
export function computeRelevanceScore(parsed: ParsedRelease, request: MediaRequest): number {
  let score = 1;
  if (request.year !== undefined && parsed.year !== undefined && parsed.year !== request.year) {
    score -= 0.4;
  }
  if (request.season !== undefined && parsed.season !== undefined && parsed.season !== request.season) {
    score -= 0.4;
  }
  if (request.episode !== undefined && parsed.episode !== undefined && parsed.episode !== request.episode) {
    score -= 0.4;
  }
  return Math.max(0, score);
}
