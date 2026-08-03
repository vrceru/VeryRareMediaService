import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { resolveWithinRoot, PathTraversalError } from "../../src/security/pathSanitizer.js";

describe("resolveWithinRoot", () => {
  const root = join("C:", "library", "movies");

  it("resolves a normal relative path inside the root", () => {
    const result = resolveWithinRoot(root, "Some Movie (2020)/Some Movie (2020).mkv");
    expect(result.startsWith(root)).toBe(true);
  });

  it("throws PathTraversalError for ../ escapes", () => {
    expect(() => resolveWithinRoot(root, "../../etc/passwd")).toThrow(PathTraversalError);
  });

  it("throws PathTraversalError for absolute paths outside the root", () => {
    expect(() => resolveWithinRoot(root, join("C:", "Windows", "System32"))).toThrow(PathTraversalError);
  });

  it("allows an absolute path that is legitimately inside the root", () => {
    const inside = join(root, "Inside Movie", "file.mkv");
    expect(() => resolveWithinRoot(root, inside)).not.toThrow();
  });
});
