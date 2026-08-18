const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtu.be", "music.youtube.com", "m.youtube.com"]);

export class InvalidYoutubeUrlError extends Error {}

/**
 * yt-dlp supports thousands of sites beyond YouTube — without this check, an ingestion
 * endpoint that hands user input straight to yt-dlp would effectively become a generic
 * arbitrary-URL downloader. Every playlist/video URL must pass this before it's ever used.
 */
export function parseYoutubeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidYoutubeUrlError(`"${raw}" is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidYoutubeUrlError(`Unsupported protocol "${url.protocol}"`);
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new InvalidYoutubeUrlError(`"${url.hostname}" is not a supported YouTube host`);
  }
  return url;
}

export function isPlaylistUrl(url: URL): boolean {
  return url.searchParams.has("list") || url.pathname.startsWith("/playlist");
}

export function isVideoUrl(url: URL): boolean {
  if (url.hostname.toLowerCase() === "youtu.be") {
    return url.pathname.length > 1;
  }
  return url.searchParams.has("v") || url.pathname.startsWith("/watch") || url.pathname.startsWith("/shorts/");
}

export function extractVideoId(url: URL): string | undefined {
  if (url.hostname.toLowerCase() === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || undefined;
  }
  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.slice("/shorts/".length).split("/")[0] || undefined;
  }
  return url.searchParams.get("v") ?? undefined;
}

export function extractPlaylistId(url: URL): string | undefined {
  return url.searchParams.get("list") ?? undefined;
}
