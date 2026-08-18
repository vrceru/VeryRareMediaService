import { describe, it, expect } from "vitest";
import {
  parseYoutubeUrl,
  isPlaylistUrl,
  isVideoUrl,
  extractVideoId,
  extractPlaylistId,
  InvalidYoutubeUrlError,
} from "../../../src/providers/download/youtube/urlValidation.js";

describe("parseYoutubeUrl", () => {
  it("accepts a valid playlist URL", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/playlist?list=PLabc123");
    expect(url.hostname).toBe("www.youtube.com");
  });

  it("accepts a valid video URL", () => {
    expect(() => parseYoutubeUrl("https://www.youtube.com/watch?v=abc123")).not.toThrow();
  });

  it("accepts a youtu.be short URL", () => {
    expect(() => parseYoutubeUrl("https://youtu.be/abc123")).not.toThrow();
  });

  it("rejects a malformed URL", () => {
    expect(() => parseYoutubeUrl("not a url")).toThrow(InvalidYoutubeUrlError);
  });

  it("rejects a non-YouTube host", () => {
    expect(() => parseYoutubeUrl("https://vimeo.com/playlist?list=abc")).toThrow(InvalidYoutubeUrlError);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(() => parseYoutubeUrl("ftp://youtube.com/watch?v=abc")).toThrow(InvalidYoutubeUrlError);
  });

  it("rejects a host that merely contains 'youtube.com' as a suffix trick", () => {
    expect(() => parseYoutubeUrl("https://youtube.com.evil.example/watch?v=abc")).toThrow(InvalidYoutubeUrlError);
  });
});

describe("isPlaylistUrl / isVideoUrl", () => {
  it("recognizes a playlist URL by its list param", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/watch?v=abc&list=PLxyz");
    expect(isPlaylistUrl(url)).toBe(true);
  });

  it("recognizes a bare /playlist path", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/playlist?list=PLxyz");
    expect(isPlaylistUrl(url)).toBe(true);
  });

  it("does not treat a plain video URL as a playlist", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/watch?v=abc123");
    expect(isPlaylistUrl(url)).toBe(false);
    expect(isVideoUrl(url)).toBe(true);
  });

  it("recognizes a youtu.be URL as a video URL", () => {
    const url = parseYoutubeUrl("https://youtu.be/abc123");
    expect(isVideoUrl(url)).toBe(true);
  });

  it("recognizes a /shorts/ URL as a video URL", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/shorts/abc123");
    expect(isVideoUrl(url)).toBe(true);
  });
});

describe("extractVideoId / extractPlaylistId", () => {
  it("extracts the video id from a watch URL", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/watch?v=abc123");
    expect(extractVideoId(url)).toBe("abc123");
  });

  it("extracts the video id from a youtu.be URL", () => {
    const url = parseYoutubeUrl("https://youtu.be/abc123");
    expect(extractVideoId(url)).toBe("abc123");
  });

  it("extracts the playlist id", () => {
    const url = parseYoutubeUrl("https://www.youtube.com/playlist?list=PLxyz");
    expect(extractPlaylistId(url)).toBe("PLxyz");
  });
});
