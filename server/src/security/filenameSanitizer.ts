// Characters invalid on Windows (also unsafe/unwise on POSIX): control chars and < > : " / \ | ? *
const UNSAFE_CHARS = /[\x00-\x1f<>:"/\\|?*]/g;
const RESERVED_WINDOWS_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/** Sanitizes a single path segment (file or directory name) for safe, cross-platform use. */
export function sanitizeFilename(name: string): string {
  let cleaned = name.replace(UNSAFE_CHARS, "").trim();
  cleaned = cleaned.replace(/\.+$/, "").trim();

  if (cleaned.length === 0) cleaned = "untitled";
  if (RESERVED_WINDOWS_NAMES.has(cleaned.toUpperCase())) cleaned = `_${cleaned}`;

  return cleaned.slice(0, 200);
}

/** Sanitizes a multi-segment relative path (e.g. from a naming template) segment by segment. */
export function sanitizeRelativePath(relativePath: string): string {
  return relativePath
    .split(/[/\\]/)
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map(sanitizeFilename)
    .join("/");
}
