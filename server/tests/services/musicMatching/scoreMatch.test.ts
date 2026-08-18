import { describe, it, expect } from "vitest";
import { stringSimilarity, scoreMatch, scoreCandidates } from "../../../src/services/musicMatching/scoreMatch.js";

describe("stringSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(stringSimilarity("Get Lucky", "Get Lucky")).toBe(1);
  });

  it("is case- and punctuation-insensitive", () => {
    expect(stringSimilarity("Get Lucky", "get lucky!")).toBeCloseTo(1, 1);
  });

  it("returns a low score for unrelated strings", () => {
    expect(stringSimilarity("Get Lucky", "Bohemian Rhapsody")).toBeLessThan(0.3);
  });

  it("returns a partial score for a close-but-not-exact match", () => {
    const sim = stringSimilarity("Get Lucky", "Get Lucky (Radio Edit)");
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(1);
  });
});

describe("scoreMatch", () => {
  it("scores an exact artist+title match highly", () => {
    const score = scoreMatch({ artist: "Daft Punk", title: "Get Lucky" }, { title: "Get Lucky", artist: "Daft Punk" });
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("scores a completely wrong candidate low", () => {
    const score = scoreMatch(
      { artist: "Daft Punk", title: "Get Lucky" },
      { title: "Bohemian Rhapsody", artist: "Queen" },
    );
    expect(score).toBeLessThan(40);
  });

  it("scores lower without an artist to corroborate the title match", () => {
    const withArtist = scoreMatch({ artist: "Daft Punk", title: "Get Lucky" }, { title: "Get Lucky", artist: "Daft Punk" });
    const withoutArtist = scoreMatch({ title: "Get Lucky" }, { title: "Get Lucky" });
    expect(withoutArtist).toBeLessThan(withArtist);
  });

  it("nudges the score up when duration closely matches", () => {
    const withoutDuration = scoreMatch({ artist: "Artist", title: "Song" }, { title: "Song", artist: "Artist", durationSeconds: 240 });
    const withCloseDuration = scoreMatch(
      { artist: "Artist", title: "Song" },
      { title: "Song", artist: "Artist", durationSeconds: 240 },
      241,
    );
    expect(withCloseDuration).toBeGreaterThanOrEqual(withoutDuration);
  });

  it("nudges the score down when duration is way off", () => {
    const close = scoreMatch(
      { artist: "Artist", title: "Song" },
      { title: "Song", artist: "Artist", durationSeconds: 240 },
      241,
    );
    const farOff = scoreMatch(
      { artist: "Artist", title: "Song" },
      { title: "Song", artist: "Artist", durationSeconds: 240 },
      60,
    );
    expect(farOff).toBeLessThan(close);
  });

  it("always returns a score between 0 and 100", () => {
    const score = scoreMatch({ title: "xyz" }, { title: "abc" });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("scoreCandidates", () => {
  it("sorts multiple candidates best-match-first", () => {
    const results = scoreCandidates({ artist: "Daft Punk", title: "Get Lucky" }, [
      { title: "Get Lucky (Live)", artist: "Daft Punk" },
      { title: "Bohemian Rhapsody", artist: "Queen" },
      { title: "Get Lucky", artist: "Daft Punk" },
    ]);
    expect(results[0]!.candidate.title).toBe("Get Lucky");
    expect(results.at(-1)!.candidate.title).toBe("Bohemian Rhapsody");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    expect(results[1]!.score).toBeGreaterThan(results[2]!.score);
  });

  it("returns an empty array for no candidates", () => {
    expect(scoreCandidates({ title: "x" }, [])).toEqual([]);
  });
});
