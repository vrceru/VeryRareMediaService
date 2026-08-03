import type { ParsedRelease } from "./types.js";

const KNOWN_EXTENSIONS =
  /\.(mkv|mp4|avi|mov|m4v|ts|wmv|webm|mp3|flac|m4a|wav|ogg|aac|opus|zip|rar|7z|nzb|torrent)$/i;

const RESOLUTION_PATTERN = /\b(4320p|2160p|1080p|720p|576p|540p|480p|360p|4K|8K|UHD)\b/i;
const RESOLUTION_ALIASES: Record<string, string> = { "4k": "2160p", "8k": "4320p", uhd: "2160p" };

const SOURCE_PATTERN =
  /\b(Blu-?Ray|BDRemux|BDRip|BRRip|WEB-?DL|WEBRip|WEB(?![A-Za-z])|HDTV|PDTV|DSR|HDRip|DVDRip|DVDR|DVD|BDR|SCREENER|SCR|TC|TS|CAM)\b/i;
const SOURCE_MAP: Record<string, string> = {
  bluray: "bluray",
  bdremux: "bdremux",
  bdrip: "bdrip",
  brrip: "brrip",
  webdl: "webdl",
  webrip: "webrip",
  web: "web",
  hdtv: "hdtv",
  pdtv: "pdtv",
  dsr: "dsr",
  hdrip: "hdrip",
  dvdrip: "dvdrip",
  dvdr: "dvdr",
  dvd: "dvd",
  bdr: "bdr",
  screener: "screener",
  scr: "screener",
  tc: "tc",
  ts: "ts",
  cam: "cam",
};
function canonicalizeSource(raw: string): string | undefined {
  return SOURCE_MAP[raw.toLowerCase().replace(/[\s-]/g, "")];
}

const CODEC_PATTERN = /\b(x265|h\.?265|HEVC|x264|h\.?264|AVC|AV1|XviD|DivX)\b/i;
const CODEC_MAP: Record<string, string> = {
  x265: "hevc",
  h265: "hevc",
  hevc: "hevc",
  x264: "avc",
  h264: "avc",
  avc: "avc",
  av1: "av1",
  xvid: "xvid",
  divx: "divx",
};
function canonicalizeCodec(raw: string): string | undefined {
  return CODEC_MAP[raw.toLowerCase().replace(/[.\s]/g, "")];
}

const AUDIO_PATTERN = /\b(TrueHD|Atmos|DTS-?HD|DTS|DDP?\d(?:\.\d)?|EAC3|AC3|FLAC|AAC|MP3)\b/i;
const AUDIO_MAP: Record<string, string> = {
  truehd: "truehd",
  atmos: "atmos",
  "dts-hd": "dtshd",
  dtshd: "dtshd",
  dts: "dts",
  eac3: "eac3",
  ac3: "ac3",
  flac: "flac",
  aac: "aac",
  mp3: "mp3",
};
function canonicalizeAudio(raw: string): string | undefined {
  const key = raw.toLowerCase();
  if (/^ddp?\d(\.\d)?$/.test(key)) return "ddp";
  return AUDIO_MAP[key];
}

const PROPER_PATTERN = /\bPROPER\b/i;
const REPACK_PATTERN = /\b(REPACK|REAL)\b/i;

const MULTI_EPISODE_PATTERN = /\bS(\d{1,2})E(\d{1,3})(?:-?E(\d{1,3}))?\b/i;
const ALT_EPISODE_PATTERN = /\b(\d{1,2})x(\d{1,3})\b/;
const VERBOSE_EPISODE_PATTERN = /Season\s?(\d{1,2}).{0,10}?Episode\s?(\d{1,3})/i;
const ANIME_EPISODE_PATTERN = /\s-\s(\d{1,4})(?:v\d+)?(?=\s|\[|$)/;

const YEAR_PATTERN = /\b(19\d{2}|20\d{2})\b/;

const GROUP_PREFIX_PATTERN = /^\[([^\]]+)]\s*/;
const GROUP_SUFFIX_PATTERN = /-([A-Za-z0-9]+)$/;

interface TagMatch {
  index: number;
}

/**
 * Extracts structured info (title, year, season/episode, resolution, source, codec, audio,
 * release group, proper/repack flags) from a scene- or anime-style release name. Heuristic —
 * covers the common naming conventions, not a full grammar. Works on either a bare release
 * title (as returned by a search) or a filename (extension is stripped automatically).
 */
export function parseReleaseName(rawName: string): ParsedRelease {
  const withoutExtension = rawName.replace(KNOWN_EXTENSIONS, "");

  let working = withoutExtension;
  let releaseGroup: string | undefined;
  let groupStyle: ParsedRelease["groupStyle"] | undefined;

  const prefixMatch = GROUP_PREFIX_PATTERN.exec(working);
  if (prefixMatch) {
    releaseGroup = prefixMatch[1];
    groupStyle = "prefix";
    working = working.slice(prefixMatch[0].length);
  } else {
    const suffixMatch = GROUP_SUFFIX_PATTERN.exec(working);
    if (suffixMatch) {
      releaseGroup = suffixMatch[1];
      groupStyle = "suffix";
    }
  }

  const matches: TagMatch[] = [];
  let resolution: string | undefined;
  let source: string | undefined;
  let codec: string | undefined;
  let audioCodec: string | undefined;

  const resMatch = RESOLUTION_PATTERN.exec(working);
  if (resMatch) {
    matches.push({ index: resMatch.index });
    const key = resMatch[1]!.toLowerCase();
    resolution = RESOLUTION_ALIASES[key] ?? key;
  }

  const sourceMatch = SOURCE_PATTERN.exec(working);
  if (sourceMatch) {
    matches.push({ index: sourceMatch.index });
    source = canonicalizeSource(sourceMatch[1]!);
  }

  const codecMatch = CODEC_PATTERN.exec(working);
  if (codecMatch) {
    matches.push({ index: codecMatch.index });
    codec = canonicalizeCodec(codecMatch[1]!);
  }

  const audioMatch = AUDIO_PATTERN.exec(working);
  if (audioMatch) {
    matches.push({ index: audioMatch.index });
    audioCodec = canonicalizeAudio(audioMatch[1]!);
  }

  const isProper = PROPER_PATTERN.test(working);
  const properMatch = PROPER_PATTERN.exec(working);
  if (properMatch) matches.push({ index: properMatch.index });

  const isRepack = REPACK_PATTERN.test(working);
  const repackMatch = REPACK_PATTERN.exec(working);
  if (repackMatch) matches.push({ index: repackMatch.index });

  if (groupStyle === "suffix") {
    const idx = working.lastIndexOf(`-${releaseGroup}`);
    if (idx >= 0) matches.push({ index: idx });
  }

  // Season/episode: try patterns in order of specificity.
  let season: number | undefined;
  let episode: number | undefined;
  let episodeEnd: number | undefined;
  let episodeMatchIndex: number | undefined;

  const multiMatch = MULTI_EPISODE_PATTERN.exec(working);
  if (multiMatch) {
    season = Number(multiMatch[1]);
    episode = Number(multiMatch[2]);
    if (multiMatch[3]) episodeEnd = Number(multiMatch[3]);
    episodeMatchIndex = multiMatch.index;
  } else {
    const altMatch = ALT_EPISODE_PATTERN.exec(working);
    if (altMatch) {
      season = Number(altMatch[1]);
      episode = Number(altMatch[2]);
      episodeMatchIndex = altMatch.index;
    } else {
      const verboseMatch = VERBOSE_EPISODE_PATTERN.exec(working);
      if (verboseMatch) {
        season = Number(verboseMatch[1]);
        episode = Number(verboseMatch[2]);
        episodeMatchIndex = verboseMatch.index;
      } else {
        const animeMatch = ANIME_EPISODE_PATTERN.exec(working);
        if (animeMatch) {
          episode = Number(animeMatch[1]);
          episodeMatchIndex = animeMatch.index;
        }
      }
    }
  }
  if (episodeMatchIndex !== undefined) matches.push({ index: episodeMatchIndex });

  // Year: only search the region before any season/episode match, so e.g. "S01E02" digits
  // are never misread as a year, and prefer "Title.2020.S01E02..." ordering.
  const yearSearchRegion = episodeMatchIndex !== undefined ? working.slice(0, episodeMatchIndex) : working;
  const yearMatch = YEAR_PATTERN.exec(yearSearchRegion);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  if (yearMatch) matches.push({ index: yearMatch.index });

  const cutIndex = matches.length > 0 ? Math.min(...matches.map((m) => m.index)) : working.length;
  const title = cleanTitle(working.slice(0, cutIndex));

  return {
    title: title || withoutExtension,
    ...(year !== undefined ? { year } : {}),
    ...(season !== undefined ? { season } : {}),
    ...(episode !== undefined ? { episode } : {}),
    ...(episodeEnd !== undefined ? { episodeEnd } : {}),
    ...(resolution !== undefined ? { resolution } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(codec !== undefined ? { codec } : {}),
    ...(audioCodec !== undefined ? { audioCodec } : {}),
    ...(releaseGroup !== undefined ? { releaseGroup } : {}),
    ...(groupStyle !== undefined ? { groupStyle } : {}),
    isProper,
    isRepack,
  };
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[-\s]+$/, "")
    .replace(/^[-\s]+/, "")
    .trim();
}
