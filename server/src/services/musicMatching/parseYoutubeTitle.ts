export interface ParsedYoutubeTitle {
  artist?: string;
  title: string;
}

// Common noise in music-video titles that isn't part of the actual track title.
const NOISE_PATTERNS: RegExp[] = [
  /\(\s*official\s*(music\s*)?video\s*\)/gi,
  /\[\s*official\s*(music\s*)?video\s*\]/gi,
  /\(\s*official\s*audio\s*\)/gi,
  /\[\s*official\s*audio\s*\]/gi,
  /\(\s*official\s*\)/gi,
  /\[\s*official\s*\]/gi,
  /\(\s*lyric(s)?\s*video\s*\)/gi,
  /\[\s*lyric(s)?\s*video\s*\]/gi,
  /\(\s*lyrics?\s*\)/gi,
  /\[\s*lyrics?\s*\]/gi,
  /\(\s*audio\s*\)/gi,
  /\[\s*audio\s*\]/gi,
  /\(\s*hd\s*\)/gi,
  /\[\s*hd\s*\]/gi,
  /\(\s*4k\s*\)/gi,
  /\[\s*4k\s*\]/gi,
  /\(\s*hq\s*\)/gi,
  /\[\s*hq\s*\]/gi,
  /\bvevo\b/gi,
];

/**
 * Strips common YouTube music-video title noise and splits the common "Artist - Title"
 * convention. Heuristic, same spirit as services/releaseParsing/releaseParser.ts but for
 * music-video titles rather than scene release names — not a full grammar.
 */
export function parseYoutubeTitle(rawTitle: string, uploader?: string): ParsedYoutubeTitle {
  let cleaned = rawTitle;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  const dashMatch = /^(.+?)\s*[-–—]\s*(.+)$/.exec(cleaned);
  if (dashMatch?.[1] && dashMatch[2]) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
  }

  // Auto-generated "<Artist> - Topic" channels are a reliable artist signal when the title
  // itself has no "Artist - Title" split.
  if (uploader) {
    const topicMatch = /^(.+?)\s*-\s*Topic$/i.exec(uploader);
    if (topicMatch?.[1]) {
      return { artist: topicMatch[1].trim(), title: cleaned };
    }
  }

  return { title: cleaned };
}
