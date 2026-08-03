import { describe, it, expect } from "vitest";
import { parseReleaseName } from "../../../src/services/releaseParsing/releaseParser.js";

describe("parseReleaseName", () => {
  it("parses a standard scene movie release", () => {
    const parsed = parseReleaseName("The.Matrix.1999.1080p.BluRay.x264-SPARKS");
    expect(parsed.title).toBe("The Matrix");
    expect(parsed.year).toBe(1999);
    expect(parsed.resolution).toBe("1080p");
    expect(parsed.source).toBe("bluray");
    expect(parsed.codec).toBe("avc");
    expect(parsed.releaseGroup).toBe("SPARKS");
    expect(parsed.groupStyle).toBe("suffix");
    expect(parsed.season).toBeUndefined();
  });

  it("parses a WEB-DL release with audio and HEVC codec", () => {
    const parsed = parseReleaseName("Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.HEVC-GROUP");
    expect(parsed.title).toBe("Dune Part Two");
    expect(parsed.year).toBe(2024);
    expect(parsed.resolution).toBe("2160p");
    expect(parsed.source).toBe("webdl");
    expect(parsed.codec).toBe("hevc");
    expect(parsed.audioCodec).toBe("ddp");
    expect(parsed.releaseGroup).toBe("GROUP");
  });

  it("parses a standard scene TV episode release", () => {
    const parsed = parseReleaseName("Show.Name.S02E05.720p.WEB-DL.H264-GROUP");
    expect(parsed.title).toBe("Show Name");
    expect(parsed.season).toBe(2);
    expect(parsed.episode).toBe(5);
    expect(parsed.resolution).toBe("720p");
    expect(parsed.source).toBe("webdl");
    expect(parsed.codec).toBe("avc");
  });

  it("parses a multi-episode range", () => {
    const parsed = parseReleaseName("Show.Name.S01E01-E03.1080p.HDTV.x264-GROUP");
    expect(parsed.season).toBe(1);
    expect(parsed.episode).toBe(1);
    expect(parsed.episodeEnd).toBe(3);
  });

  it("parses the '1x02' alternate episode format", () => {
    const parsed = parseReleaseName("Show Name 1x02 720p HDTV");
    expect(parsed.season).toBe(1);
    expect(parsed.episode).toBe(2);
  });

  it("parses verbose 'Season X Episode Y' naming", () => {
    const parsed = parseReleaseName("Show Name Season 3 Episode 12");
    expect(parsed.season).toBe(3);
    expect(parsed.episode).toBe(12);
  });

  it("parses an anime-style release with a leading fansub group and bare episode number", () => {
    const parsed = parseReleaseName("[SubsPlease] Show Name - 05 [1080p].mkv");
    expect(parsed.releaseGroup).toBe("SubsPlease");
    expect(parsed.groupStyle).toBe("prefix");
    expect(parsed.title).toBe("Show Name");
    expect(parsed.episode).toBe(5);
    expect(parsed.season).toBeUndefined();
    expect(parsed.resolution).toBe("1080p");
  });

  it("does not misread SxxEyy digits as a year", () => {
    const parsed = parseReleaseName("Show.Name.S01E02.720p.HDTV.x264-GROUP");
    expect(parsed.year).toBeUndefined();
  });

  it("finds the year even when it appears before the episode marker", () => {
    const parsed = parseReleaseName("Show.Name.2019.S01E02.720p.HDTV.x264-GROUP");
    expect(parsed.year).toBe(2019);
    expect(parsed.season).toBe(1);
  });

  it("detects PROPER and REPACK flags", () => {
    expect(parseReleaseName("Movie.2020.PROPER.1080p.BluRay.x264-GROUP").isProper).toBe(true);
    expect(parseReleaseName("Movie.2020.REPACK.1080p.BluRay.x264-GROUP").isRepack).toBe(true);
    expect(parseReleaseName("Movie.2020.1080p.BluRay.x264-GROUP").isProper).toBe(false);
  });

  it("normalizes 4K/UHD to the 2160p resolution key", () => {
    expect(parseReleaseName("Movie.2020.4K.BluRay-GROUP").resolution).toBe("2160p");
    expect(parseReleaseName("Movie.2020.UHD.BluRay-GROUP").resolution).toBe("2160p");
  });

  it("strips a known file extension before parsing", () => {
    const parsed = parseReleaseName("Movie.2020.1080p.BluRay.x264-GROUP.mkv");
    expect(parsed.releaseGroup).toBe("GROUP");
    expect(parsed.title).toBe("Movie");
  });

  it("cleans dots and underscores out of the title", () => {
    const parsed = parseReleaseName("Some_Movie.Title.2020.1080p.WEBRip");
    expect(parsed.title).toBe("Some Movie Title");
  });

  it("falls back to the raw name as title when nothing else can be parsed", () => {
    const parsed = parseReleaseName("random-release-name-with-no-tags");
    expect(parsed.title.length).toBeGreaterThan(0);
    expect(parsed.year).toBeUndefined();
    expect(parsed.resolution).toBeUndefined();
  });

  it("handles a music release with no season/episode markers", () => {
    const parsed = parseReleaseName("Artist.Name.Album.Title.2021.FLAC-GROUP");
    expect(parsed.audioCodec).toBe("flac");
    expect(parsed.year).toBe(2021);
    expect(parsed.season).toBeUndefined();
  });
});
