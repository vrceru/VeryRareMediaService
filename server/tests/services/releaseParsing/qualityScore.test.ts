import { describe, it, expect } from "vitest";
import { parseReleaseName } from "../../../src/services/releaseParsing/releaseParser.js";
import { computeQualityScore } from "../../../src/services/releaseParsing/qualityScore.js";

describe("computeQualityScore", () => {
  it("scores a 2160p BluRay HEVC release higher than a 480p CAM release", () => {
    const good = parseReleaseName("Movie.2020.2160p.BluRay.HEVC-GROUP");
    const bad = parseReleaseName("Movie.2020.480p.CAM.XviD-GROUP");
    expect(computeQualityScore(good)).toBeGreaterThan(computeQualityScore(bad));
  });

  it("scores 1080p BluRay higher than 1080p WEBRip at the same resolution", () => {
    const bluray = parseReleaseName("Movie.2020.1080p.BluRay.x264-GROUP");
    const webrip = parseReleaseName("Movie.2020.1080p.WEBRip.x264-GROUP");
    expect(computeQualityScore(bluray)).toBeGreaterThan(computeQualityScore(webrip));
  });

  it("gives a small bump to PROPER/REPACK releases over an otherwise identical one", () => {
    const base = parseReleaseName("Movie.2020.1080p.BluRay.x264-GROUP");
    const proper = parseReleaseName("Movie.2020.PROPER.1080p.BluRay.x264-GROUP");
    expect(computeQualityScore(proper)).toBeGreaterThan(computeQualityScore(base));
  });

  it("always returns a score between 0 and 1", () => {
    const parsed = parseReleaseName("completely-unparseable-release-name");
    const score = computeQualityScore(parsed);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
