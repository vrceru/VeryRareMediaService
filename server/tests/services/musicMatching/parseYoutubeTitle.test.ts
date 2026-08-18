import { describe, it, expect } from "vitest";
import { parseYoutubeTitle } from "../../../src/services/musicMatching/parseYoutubeTitle.js";

describe("parseYoutubeTitle", () => {
  it("splits a standard 'Artist - Title' pattern", () => {
    const parsed = parseYoutubeTitle("Some Artist - Some Song");
    expect(parsed.artist).toBe("Some Artist");
    expect(parsed.title).toBe("Some Song");
  });

  it("strips '(Official Video)' noise before splitting", () => {
    const parsed = parseYoutubeTitle("Some Artist - Some Song (Official Video)");
    expect(parsed.artist).toBe("Some Artist");
    expect(parsed.title).toBe("Some Song");
  });

  it("strips '(Official Audio)' and '[HD]' noise", () => {
    const parsed = parseYoutubeTitle("Some Artist - Some Song (Official Audio) [HD]");
    expect(parsed.title).toBe("Some Song");
  });

  it("strips '(Lyrics)' noise", () => {
    const parsed = parseYoutubeTitle("Some Artist - Some Song (Lyrics)");
    expect(parsed.title).toBe("Some Song");
  });

  it("handles an em-dash separator", () => {
    const parsed = parseYoutubeTitle("Some Artist — Some Song");
    expect(parsed.artist).toBe("Some Artist");
    expect(parsed.title).toBe("Some Song");
  });

  it("falls back to the '<Artist> - Topic' uploader convention when the title has no dash", () => {
    const parsed = parseYoutubeTitle("Some Song (Official Audio)", "Some Artist - Topic");
    expect(parsed.artist).toBe("Some Artist");
    expect(parsed.title).toBe("Some Song");
  });

  it("returns just a cleaned title when there's no artist signal at all", () => {
    const parsed = parseYoutubeTitle("Some Song (Official Audio)", "Random Channel Name");
    expect(parsed.artist).toBeUndefined();
    expect(parsed.title).toBe("Some Song");
  });

  it("collapses extra whitespace left behind by noise stripping", () => {
    const parsed = parseYoutubeTitle("Some Artist   -   Some Song   (Official Video)");
    expect(parsed.title).toBe("Some Song");
  });
});
