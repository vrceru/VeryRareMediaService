import { describe, it, expect } from "vitest";
import { renderTemplate, pad2 } from "../../src/services/naming/templateEngine.js";
import { buildNamingTokens } from "../../src/services/naming/buildNamingTokens.js";
import type { MediaMetadata } from "../../src/providers/metadata/types.js";

describe("renderTemplate", () => {
  it("substitutes known tokens", () => {
    const result = renderTemplate("{title} ({year})", { title: "Inception", year: 2010 });
    expect(result).toBe("Inception (2010)");
  });

  it("trims a dangling separator left by an empty token at the end of a segment", () => {
    const result = renderTemplate("{title} - {missing}", { title: "X" });
    expect(result).toBe("X");
  });

  it("drops a blank episodeTitle segment before the extension", () => {
    const result = renderTemplate("{title}/Season {seasonPadded}/{title} - S{seasonPadded}E{episodePadded} - {episodeTitle}{extension}", {
      title: "Show",
      seasonPadded: "02",
      episodePadded: "01",
      extension: ".mkv",
    });
    expect(result).toBe("Show/Season 02/Show - S02E01.mkv");
  });

  it("keeps a real episodeTitle intact", () => {
    const result = renderTemplate("{title} - S{seasonPadded}E{episodePadded} - {episodeTitle}{extension}", {
      title: "Show",
      seasonPadded: "02",
      episodePadded: "01",
      episodeTitle: "Pilot",
      extension: ".mkv",
    });
    expect(result).toBe("Show - S02E01 - Pilot.mkv");
  });
});

describe("pad2", () => {
  it("pads single digits and leaves undefined as undefined", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
    expect(pad2(undefined)).toBeUndefined();
  });
});

describe("buildNamingTokens", () => {
  it("derives padded season/episode tokens from metadata", () => {
    const metadata: MediaMetadata = {
      provider: "tmdb-tv",
      externalId: "1",
      title: "Show",
      genres: [],
      season: 2,
      episode: 5,
    };
    const tokens = buildNamingTokens(metadata, ".mkv");
    expect(tokens.seasonPadded).toBe("02");
    expect(tokens.episodePadded).toBe("05");
    expect(tokens.extension).toBe(".mkv");
  });
});
