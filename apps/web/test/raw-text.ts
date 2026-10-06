import { readFileSync } from 'node:fs';

const ALLOWED = new Set([

  'ADR', 'KAST', 'KPR', 'DPR', 'APR', 'K/D', 'HS%', 'MVP', 'CT', 'T',
  'SteamID', 'SteamID64', 'Steam', 'CS2', 'GOTV', 'HLTV', 'FACEIT',
  'Gamers Club', 'Valve', 'DuckDB', 'SQL', 'CSV', 'JSON', 'PNG', 'ZIP',
  'ADR 0010', 'ADR 0013', 'HS',

  'sv_cheats 1', 'resolution', 'offset', 'tick', 'ticks',

  '—', '–', '·', '≈', ':', '/', '+', '-', '%', '?', '…', 'x', 'v', 'vs',
]);

const JSX_TEXT = [
  />([^<>{}]+)</g,
  /\}([^<>{}]+)</g,
  />([^<>{}]+)\{/g,
  /\}([^<>{}]+)\{/g,
];

const ATTRS = /\b(?:title|aria-label|placeholder|tip|label|hint|text|empty)="([^"]+)"/g;

export interface RawString {
  file: string;
  line: number;
  text: string;
}

function withoutComments(source: string): string {

  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
}

export function isUiText(raw: string): boolean {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length < 2) return false;
  if (ALLOWED.has(text)) return false;

  if (!/[A-Za-zÀ-ú]{2}/.test(text)) return false;

  if (/[=$\\]|=>|\?\?|&&|\|\||\.\w+\(|^\w+\.\w+$/.test(text)) return false;

  if (/^&\s|^\|\s|React\.|Props\b|Promise\b|: \w+[,)]|\)\s*:/.test(text)) return false;

  if (/\binterface\s|\btype\s+\w+\s*=|^from '|\bof\s+\w+[.)]/.test(text)) return false;

  if (/\b(const|let|return|if|for|while|function|import|export|typeof|catch|finally|else|try|switch|await|async)\b/.test(text)) return false;
  if (/: Record|: string|: number|: boolean|void[;)]|\w+\?:|: Set|: Map|: \(|Partial</.test(text)) return false;

  if (/[[\]`]|\.\.\.|\.current|,$|^,|\bstate:|\w+:$/.test(text)) return false;

  if (/^\)|\($|\s\?\s/.test(text)) return false;
  return true;
}

export function findRawStrings(file: string, source?: string): RawString[] {
  const code = withoutComments(source ?? readFileSync(file, 'utf8'));
  const out: RawString[] = [];
  const lineOf = (index: number) => code.slice(0, index).split('\n').length;

  for (const pattern of JSX_TEXT) {
    for (const match of code.matchAll(pattern)) {
      if (isUiText(match[1]!)) {
        out.push({ file, line: lineOf(match.index), text: match[1]!.replace(/\s+/g, ' ').trim() });
      }
    }
  }
  for (const match of code.matchAll(ATTRS)) {
    if (isUiText(match[1]!)) {
      out.push({ file, line: lineOf(match.index), text: match[1]!.trim() });
    }
  }
  return out;
}
