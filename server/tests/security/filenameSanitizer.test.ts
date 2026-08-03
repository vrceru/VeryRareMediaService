import { describe, it, expect } from "vitest";
import { sanitizeFilename, sanitizeRelativePath } from "../../src/security/filenameSanitizer.js";

describe("sanitizeFilename", () => {
  it("strips characters invalid on Windows", () => {
    expect(sanitizeFilename('Bad:Name<>|?*"')).toBe("BadName");
  });

  it("falls back to 'untitled' for an empty result", () => {
    expect(sanitizeFilename("///")).toBe("untitled");
  });

  it("prefixes reserved Windows device names", () => {
    expect(sanitizeFilename("CON")).toBe("_CON");
    expect(sanitizeFilename("com1")).toBe("_com1");
  });

  it("leaves normal filenames untouched", () => {
    expect(sanitizeFilename("Some Movie (2020).mkv")).toBe("Some Movie (2020).mkv");
  });
});

describe("sanitizeRelativePath", () => {
  it("drops .. and . segments to prevent traversal", () => {
    expect(sanitizeRelativePath("../../etc/passwd")).toBe("etc/passwd");
  });

  it("sanitizes each segment independently", () => {
    expect(sanitizeRelativePath("Show: Name/Season 01/Ep<1>.mkv")).toBe(
      "Show Name/Season 01/Ep1.mkv",
    );
  });
});
