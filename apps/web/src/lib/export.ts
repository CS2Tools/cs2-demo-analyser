import { transport } from './transport';

export type Cell = string | number | boolean | null | undefined;

export interface TableData {
  columns: string[];
  rows: Cell[][];
}

export type ExportFormat = 'csv' | 'json' | 'png';

export function toCsv(table: TableData): string {
  const cell = (v: Cell): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.columns, ...table.rows].map((r) => r.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export interface ExportMeta {

  title: string;
  matchId?: string;

  references?: Record<string, unknown>;
}

export function toJson(data: unknown, meta: ExportMeta): string {
  return JSON.stringify(
    {
      meta: {
        app: 'CS2 Demo Analyser',
        exportedAt: new Date().toISOString(),
        ...meta,
      },
      data,
    },
    null,
    2,
  );
}

export async function composePng(
  layers: HTMLCanvasElement[],
  opts: {
    title: string;
    subtitle?: string;
    footer?: string[];
    alphas?: number[];
    theme?: ThemeTokens;
  },
): Promise<Blob> {
  const base = layers[0];
  if (!base) throw new Error('nada para exportar');

  const theme = opts.theme ?? domTheme();
  const w = base.width;
  const scale = Math.max(1, w / 900);
  const pad = Math.round(16 * scale);
  const titleSize = Math.round(18 * scale);
  const smallSize = Math.round(12 * scale);
  const header = pad * 2 + titleSize + (opts.subtitle ? smallSize + pad / 2 : 0);
  const smallFont = `${smallSize}px ${theme.sans}`;

  const footerLines = (opts.footer ?? []).flatMap((line) =>
    wrapText(line, w - pad * 2, smallFont, domMeasure()),
  );
  const lineH = smallSize + 6 * scale;
  const footer = footerLines.length > 0 ? pad * 2 + footerLines.length * lineH : 0;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = header + base.height + footer;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('canvas indisponivel');

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.fillStyle = theme.foreground;
  ctx.font = `600 ${titleSize}px ${theme.sans}`;
  ctx.textBaseline = 'top';
  ctx.fillText(opts.title, pad, pad);
  if (opts.subtitle) {
    ctx.fillStyle = theme.mutedForeground;
    ctx.font = smallFont;
    ctx.fillText(opts.subtitle, pad, pad + titleSize + pad / 2);
  }

  layers.forEach((layer, i) => {

    ctx.globalAlpha = opts.alphas?.[i] ?? 1;
    ctx.drawImage(layer, 0, header, w, base.height);
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = theme.mutedForeground;
  ctx.font = smallFont;
  footerLines.forEach((line, i) => {
    ctx.fillText(line, pad, header + base.height + pad + i * lineH);
  });

  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('falha ao gerar PNG'))), 'image/png'),
  );
}

export function saveText(name: string, text: string, mime: string): Promise<boolean> {
  return transport.saveFile(name, new Blob([text], { type: `${mime};charset=utf-8` }));
}

export function saveBlob(name: string, blob: Blob): Promise<boolean> {
  return transport.saveFile(name, blob);
}

export function fileSlug(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 80) || 'export'
  );
}

export interface ThemeTokens {
  background: string;
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  sans: string;
  mono: string;
}

export const FALLBACK_THEME: ThemeTokens = {
  background: '#0a0a0a',
  card: '#131316',
  border: '#27272a',
  foreground: '#fafafa',
  mutedForeground: '#a1a1aa',
  sans: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
};

function usableColor(ctx: CanvasRenderingContext2D, value: string, fallback: string): string {
  const raw = value.trim();
  if (raw === '') return fallback;
  const sentinel = '#010203';
  ctx.fillStyle = sentinel;
  ctx.fillStyle = raw;
  return ctx.fillStyle === sentinel ? fallback : raw;
}

export function domTheme(): ThemeTokens {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return FALLBACK_THEME;

  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const token = (name: string, fallback: string) =>
    usableColor(probe, root.getPropertyValue(name), fallback);

  const sans = body.fontFamily.trim() || FALLBACK_THEME.sans;
  const mono = root.getPropertyValue('--font-mono').trim() || FALLBACK_THEME.mono;

  return {
    background: token('--background', FALLBACK_THEME.background),
    card: token('--card', FALLBACK_THEME.card),
    border: token('--border', FALLBACK_THEME.border),
    foreground: token('--foreground', FALLBACK_THEME.foreground),
    mutedForeground: token('--muted-foreground', FALLBACK_THEME.mutedForeground),
    sans,
    mono,
  };
}

export type Measure = (text: string, font: string) => number;

let measureCtx: CanvasRenderingContext2D | null | undefined;

export function domMeasure(): Measure {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  const ctx = measureCtx;
  if (!ctx) throw new Error('canvas indisponivel');
  return (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

export function wrapText(text: string, maxWidth: number, font: string, measure: Measure): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = words[0]!;
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (measure(candidate, font) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

export function cellText(v: Cell): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'nao';
  return String(v);
}

export interface TableLayout {
  width: number;
  height: number;

  colX: number[];
  colW: number[];
  align: ('left' | 'right')[];
  pad: number;
  rowH: number;
  headerH: number;
  fontSize: number;
  header: string[];

  cells: string[][];

  omitted: number;

  theme: ThemeTokens;
}

const MAX_ROWS = 300;

export function layoutTable(
  table: TableData,
  measure: Measure,
  opts: { scale?: number; maxRows?: number; theme?: ThemeTokens } = {},
): TableLayout {
  const scale = opts.scale ?? 1;
  const theme = opts.theme ?? FALLBACK_THEME;
  const fontSize = Math.round(13 * scale);
  const pad = Math.round(16 * scale);
  const gap = Math.round(18 * scale);
  const rowH = Math.round(fontSize * 2.1);
  const headerH = Math.round(fontSize * 2.4);
  const font = `${fontSize}px ${theme.sans}`;
  const headFont = `600 ${fontSize}px ${theme.sans}`;

  const numFont = `${fontSize}px ${theme.mono}`;
  const maxColW = Math.round(300 * scale);

  const maxRows = opts.maxRows ?? MAX_ROWS;
  const kept = table.rows.slice(0, maxRows);
  const omitted = table.rows.length - kept.length;

  const align = table.columns.map((_, c) => {
    const values = kept.map((r) => r[c]).filter((v) => v !== null && v !== undefined && v !== '');
    const numeric = values.length > 0 && values.every((v) => typeof v === 'number');
    return c === 0 ? 'left' : numeric ? 'right' : 'left';
  }) as ('left' | 'right')[];

  const bodyFont = (c: number) => (align[c] === 'right' ? numFont : font);

  const colW = table.columns.map((h) => Math.min(maxColW, Math.ceil(measure(h, headFont))));
  const cells: string[][] = [];

  const ellipsize = (text: string, limit: number, f: string): string => {
    if (measure(text, f) <= limit) return text;
    let s = text;
    while (s.length > 1 && measure(`${s}…`, f) > limit) s = s.slice(0, -1);
    return `${s}…`;
  };

  for (const row of kept) {
    const out = table.columns.map((_, c) => cellText(row[c]));
    out.forEach((text, c) => {
      colW[c] = Math.min(maxColW, Math.max(colW[c]!, Math.ceil(measure(text, bodyFont(c)))));
    });
    cells.push(out);
  }

  for (const row of cells) {
    row.forEach((text, c) => {
      if (colW[c] === maxColW) row[c] = ellipsize(text, maxColW, bodyFont(c));
    });
  }

  const colX: number[] = [];
  let x = pad;
  colW.forEach((w) => {
    colX.push(x);
    x += w + gap;
  });

  const noteH = omitted > 0 ? rowH : 0;
  return {
    width: Math.max(Math.round(420 * scale), x - gap + pad),
    height: headerH + cells.length * rowH + noteH + pad,
    theme,
    colX,
    colW,
    align,
    pad,
    rowH,
    headerH,
    fontSize,
    header: table.columns,
    cells,
    omitted,
  };
}

export function renderTableCanvas(
  table: TableData,
  opts: { scale?: number; measure?: Measure; theme?: ThemeTokens } = {},
): HTMLCanvasElement {
  const measure = opts.measure ?? domMeasure();
  const scale = opts.scale ?? 2;
  const theme = opts.theme ?? domTheme();
  const layout = layoutTable(table, measure, { scale, theme });

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponivel');

  const { pad, rowH, headerH, fontSize } = layout;
  const radius = Math.round(10 * scale);
  const hair = Math.max(1, Math.round(scale));

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'middle';

  const cardPath = () => {
    ctx.beginPath();
    ctx.roundRect(hair / 2, hair / 2, canvas.width - hair, canvas.height - hair, radius);
  };

  ctx.fillStyle = theme.card;
  cardPath();
  ctx.fill();

  ctx.fillStyle = theme.mutedForeground;
  ctx.font = `600 ${fontSize}px ${theme.sans}`;
  layout.header.forEach((text, c) => {
    const right = layout.align[c] === 'right';
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(text, right ? layout.colX[c]! + layout.colW[c]! : layout.colX[c]!, headerH / 2);
  });
  ctx.fillStyle = theme.border;
  ctx.fillRect(0, headerH - hair, canvas.width, hair);

  layout.cells.forEach((row, r) => {
    const y = headerH + r * rowH;
    if (r > 0) {
      ctx.fillStyle = theme.border;
      ctx.fillRect(pad, y, canvas.width - pad * 2, hair);
    }
    row.forEach((text, c) => {
      const right = layout.align[c] === 'right';
      ctx.textAlign = right ? 'right' : 'left';

      ctx.font = right ? `${fontSize}px ${theme.mono}` : `${fontSize}px ${theme.sans}`;
      ctx.fillStyle = c === 0 ? theme.mutedForeground : theme.foreground;
      ctx.fillText(text, right ? layout.colX[c]! + layout.colW[c]! : layout.colX[c]!, y + rowH / 2);
    });
  });

  if (layout.omitted > 0) {
    ctx.fillStyle = theme.mutedForeground;
    ctx.font = `${fontSize}px ${theme.sans}`;
    ctx.textAlign = 'left';
    ctx.fillText(
      `… e mais ${layout.omitted} linha(s) — o CSV traz todas`,
      pad,
      headerH + layout.cells.length * rowH + rowH / 2,
    );
  }

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = hair;
  cardPath();
  ctx.stroke();

  return canvas;
}

export function pngTable(spec: {
  display?: () => TableData;
  table?: () => TableData;
}): TableData | null {
  return spec.display?.() ?? spec.table?.() ?? null;
}

export function referenceFooter(meta: Omit<ExportMeta, 'title'> | undefined): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(meta?.references ?? {})) {
    const shown = Array.isArray(value) ? value.join(' / ') : String(value);
    lines.push(`${key}: ${shown}`);
  }
  return lines;
}
