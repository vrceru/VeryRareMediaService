import type { ParsedRelease } from "./types.js";

const RESOLUTION_SCORES: Record<string, number> = {
  "4320p": 1.0,
  "2160p": 0.9,
  "1080p": 0.75,
  "720p": 0.55,
  "576p": 0.35,
  "540p": 0.3,
  "480p": 0.25,
  "360p": 0.1,
};

const SOURCE_SCORES: Record<string, number> = {
  bluray: 1.0,
  bdremux: 1.0,
  bdrip: 0.9,
  brrip: 0.85,
  webdl: 0.8,
  webrip: 0.65,
  web: 0.6,
  hdrip: 0.5,
  hdtv: 0.45,
  pdtv: 0.4,
  dsr: 0.4,
  dvdrip: 0.35,
  dvdr: 0.3,
  dvd: 0.3,
  bdr: 0.9,
  screener: 0.1,
  tc: 0.08,
  ts: 0.05,
  cam: 0.02,
};

const CODEC_SCORES: Record<string, number> = {
  av1: 1.0,
  hevc: 0.9,
  avc: 0.6,
  xvid: 0.2,
  divx: 0.2,
};

const UNKNOWN_SCORE = 0.3;

/**
 * Scores a parsed release's technical quality on a 0-1 scale — resolution weighted heaviest,
 * then source, then codec, with a small bump for PROPER/REPACK (usually fixes a broken
 * original release). Used alongside seeder count to rank candidates in the select-release stage.
 */
export function computeQualityScore(parsed: ParsedRelease): number {
  const resolutionScore = parsed.resolution ? (RESOLUTION_SCORES[parsed.resolution] ?? UNKNOWN_SCORE) : UNKNOWN_SCORE;
  const sourceScore = parsed.source ? (SOURCE_SCORES[parsed.source] ?? UNKNOWN_SCORE) : UNKNOWN_SCORE;
  const codecScore = parsed.codec ? (CODEC_SCORES[parsed.codec] ?? 0.4) : 0.4;
  const fixBonus = parsed.isProper || parsed.isRepack ? 0.05 : 0;

  const score = resolutionScore * 0.5 + sourceScore * 0.35 + codecScore * 0.15 + fixBonus;
  return Math.max(0, Math.min(1, score));
}
