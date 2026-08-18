function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bigrams(s: string): string[] {
  const norm = normalize(s);
  if (norm.length < 2) return norm ? [norm] : [];
  const grams: string[] = [];
  for (let i = 0; i < norm.length - 1; i++) grams.push(norm.slice(i, i + 2));
  return grams;
}

/** Sørensen-Dice coefficient over character bigrams — a simple, dependency-free fuzzy string
 * match that tolerates word reordering and minor spelling differences better than exact/prefix
 * matching. Returns 0-1. */
export function stringSimilarity(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) {
    return normalize(a) === normalize(b) ? 1 : 0;
  }

  const counts = new Map<string, number>();
  for (const g of bigramsA) counts.set(g, (counts.get(g) ?? 0) + 1);

  let matches = 0;
  for (const g of bigramsB) {
    const remaining = counts.get(g) ?? 0;
    if (remaining > 0) {
      matches++;
      counts.set(g, remaining - 1);
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

export interface MatchCandidate {
  title: string;
  artist?: string;
  durationSeconds?: number;
}

interface ParsedSource {
  artist?: string;
  title: string;
}

/**
 * Scores how well a metadata candidate matches a parsed (artist, title) source, 0-100. Title
 * similarity dominates; artist similarity is weighted in when both sides have one, and duration
 * closeness nudges the score when both are known. No artist to compare against is a real
 * confidence penalty, not treated as neutral — an untitled match on title alone is weaker
 * evidence than one corroborated by the artist too.
 */
export function scoreMatch(source: ParsedSource, candidate: MatchCandidate, sourceDurationSeconds?: number): number {
  const titleSim = stringSimilarity(source.title, candidate.title);
  const artistSim =
    source.artist && candidate.artist ? stringSimilarity(source.artist, candidate.artist) : undefined;

  let score = artistSim !== undefined ? titleSim * 0.6 + artistSim * 0.4 : titleSim * 0.8;

  if (sourceDurationSeconds !== undefined && candidate.durationSeconds !== undefined) {
    const diffSeconds = Math.abs(sourceDurationSeconds - candidate.durationSeconds);
    const durationScore = diffSeconds <= 3 ? 1 : diffSeconds <= 10 ? 0.7 : diffSeconds <= 30 ? 0.3 : 0;
    score = score * 0.85 + durationScore * 0.15;
  }

  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export interface ScoredCandidate<T extends MatchCandidate> {
  candidate: T;
  score: number;
}

/** Scores every candidate and returns them sorted best-first. */
export function scoreCandidates<T extends MatchCandidate>(
  source: ParsedSource,
  candidates: T[],
  sourceDurationSeconds?: number,
): ScoredCandidate<T>[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreMatch(source, candidate, sourceDurationSeconds) }))
    .sort((a, b) => b.score - a.score);
}
