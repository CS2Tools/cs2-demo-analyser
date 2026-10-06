export type PlayedAtSource = 'filename' | 'file_mtime';

export interface PlayedAt {
  at: Date;
  source: PlayedAtSource;
}

const PATTERNS: { name: string; re: RegExp }[] = [

  {
    name: 'gamersclub',
    re: /(?<y>\d{4})-(?<mo>\d{2})-(?<d>\d{2})__(?<h>\d{2})(?<mi>\d{2})(?:__|\b)/,
  },

  {
    name: 'iso_datetime',
    re: /(?<y>\d{4})-(?<mo>\d{2})-(?<d>\d{2})[ _T-](?<h>\d{2})[-:.](?<mi>\d{2})(?:[-:.](?<s>\d{2}))?/,
  },

  {
    name: 'compact',
    re: /(?<y>\d{4})(?<mo>\d{2})(?<d>\d{2})[-_](?<h>\d{2})(?<mi>\d{2})(?<s>\d{2})/,
  },

  { name: 'date_only', re: /(?<y>\d{4})-(?<mo>\d{2})-(?<d>\d{2})/ },
];

const MIN_YEAR = 2012;

function fromParts(g: Record<string, string | undefined>): Date | null {
  const n = (v: string | undefined, fallback = 0) => (v === undefined ? fallback : Number(v));
  const year = n(g['y']);
  const month = n(g['mo']);
  const day = n(g['d']);
  if (year < MIN_YEAR || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const hour = n(g['h']);
  const minute = n(g['mi']);
  const second = n(g['s']);
  if (hour > 23 || minute > 59 || second > 59) return null;

  const date = new Date(year, month - 1, day, hour, minute, second);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function playedAtFromFileName(fileName: string): Date | null {
  for (const { re } of PATTERNS) {
    const match = re.exec(fileName);
    if (!match?.groups) continue;
    const date = fromParts(match.groups);
    if (date) return date;
  }
  return null;
}

export function playedAtPattern(fileName: string): string | null {
  for (const { name, re } of PATTERNS) {
    const match = re.exec(fileName);
    if (match?.groups && fromParts(match.groups)) return name;
  }
  return null;
}

export function resolvePlayedAt(fileName: string, mtime: Date | null): PlayedAt | null {
  const fromName = playedAtFromFileName(fileName);
  if (fromName) return { at: fromName, source: 'filename' };

  if (mtime && mtime.getTime() > 0 && mtime.getTime() <= Date.now() + 60_000) {
    return { at: mtime, source: 'file_mtime' };
  }
  return null;
}
