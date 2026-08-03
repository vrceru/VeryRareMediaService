import { statSync } from "node:fs";
import { extname, basename } from "node:path";

export const VIDEO_EXTENSIONS = [".mkv", ".mp4", ".avi", ".mov", ".m4v", ".ts", ".wmv", ".webm"];
export const AUDIO_EXTENSIONS = [".mp3", ".flac", ".m4a", ".wav", ".ogg", ".aac", ".opus"];

const SAMPLE_FILENAME_HINT = /\bsample\b/i;
const MIN_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — filters out obvious samples/junk
const MIN_AUDIO_BYTES = 500 * 1024; // 500KB

export interface MediaValidationResult {
  valid: boolean;
  reason?: string;
  kind: "video" | "audio" | "unknown";
}

/**
 * Heuristic media validation (extension + size + filename hints). No ffprobe dependency —
 * this catches the common cases (wrong file type, sample files, zero-byte downloads) without
 * requiring an external binary. A deeper container-integrity check can be layered on later.
 */
export function validateMediaFile(filePath: string): MediaValidationResult {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);

  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    return { valid: false, reason: "File does not exist or is unreadable", kind: "unknown" };
  }

  if (VIDEO_EXTENSIONS.includes(ext)) {
    if (SAMPLE_FILENAME_HINT.test(name)) {
      return { valid: false, reason: "Filename indicates a sample file", kind: "video" };
    }
    if (size < MIN_VIDEO_BYTES) {
      return { valid: false, reason: `File too small for a video (${size} bytes)`, kind: "video" };
    }
    return { valid: true, kind: "video" };
  }

  if (AUDIO_EXTENSIONS.includes(ext)) {
    if (size < MIN_AUDIO_BYTES) {
      return { valid: false, reason: `File too small for audio (${size} bytes)`, kind: "audio" };
    }
    return { valid: true, kind: "audio" };
  }

  return { valid: false, reason: `Unrecognized media extension "${ext}"`, kind: "unknown" };
}
