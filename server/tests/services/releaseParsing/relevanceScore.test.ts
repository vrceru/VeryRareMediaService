import { describe, it, expect } from "vitest";
import { parseReleaseName } from "../../../src/services/releaseParsing/releaseParser.js";
import { computeRelevanceScore } from "../../../src/services/releaseParsing/relevanceScore.js";
import type { MediaRequest } from "../../../src/queue/types.js";

describe("computeRelevanceScore", () => {
  it("returns 1 when the request has no explicit constraints", () => {
    const parsed = parseReleaseName("Movie.1999.1080p.BluRay.x264-GROUP");
    const request: MediaRequest = { title: "Movie" };
    expect(computeRelevanceScore(parsed, request)).toBe(1);
  });

  it("returns 1 when parsed fields match the request", () => {
    const parsed = parseReleaseName("Show.Name.S02E05.1080p.WEB-DL-GROUP");
    const request: MediaRequest = { title: "Show Name", season: 2, episode: 5 };
    expect(computeRelevanceScore(parsed, request)).toBe(1);
  });

  it("docks the score for a season mismatch", () => {
    const parsed = parseReleaseName("Show.Name.S02E05.1080p.WEB-DL-GROUP");
    const request: MediaRequest = { title: "Show Name", season: 3 };
    expect(computeRelevanceScore(parsed, request)).toBeLessThan(1);
  });

  it("docks the score for a year mismatch", () => {
    const parsed = parseReleaseName("Movie.1999.1080p.BluRay.x264-GROUP");
    const request: MediaRequest = { title: "Movie", year: 2005 };
    expect(computeRelevanceScore(parsed, request)).toBeLessThan(1);
  });

  it("never goes below 0 even with multiple mismatches", () => {
    const parsed = parseReleaseName("Show.Name.S02E05.1080p.WEB-DL-GROUP");
    const request: MediaRequest = { title: "Show Name", season: 9, episode: 9, year: 1900 };
    expect(computeRelevanceScore(parsed, request)).toBeGreaterThanOrEqual(0);
  });
});
