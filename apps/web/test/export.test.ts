import { describe, expect, it } from 'vitest';
import {
  cellText,
  fileSlug,
  layoutTable,
  referenceFooter,
  toCsv,
  toJson,
  wrapText,
  type Measure,
  type TableData,
} from '../src/lib/export';
import { wouldPrune } from '../src/lib/retention';
import type { MatchSummary } from '@cs2/contract';

describe('toCsv', () => {
  it('escapa aspas, virgulas e quebras de linha (RFC 4180)', () => {
    const csv = toCsv({
      columns: ['nome', 'kills'],
      rows: [['jogador, "um"', 20], ['linha\nquebrada', 3]],
    });
    expect(csv).toBe('﻿nome,kills\r\n"jogador, ""um""",20\r\n"linha\nquebrada",3\r\n');
  });

  it('numero sai no formato de maquina, nulo sai vazio', () => {
    const csv = toCsv({ columns: ['a', 'b', 'c'], rows: [[1.07, null, Number.NaN]] });
    expect(csv.split('\r\n')[1]).toBe('1.07,,');
  });

  it('comeca com BOM, para o Excel acertar os acentos', () => {
    expect(toCsv({ columns: ['x'], rows: [] }).charCodeAt(0)).toBe(0xfeff);
  });
});

describe('toJson', () => {
  it('leva as referencias junto dos dados', () => {
    const parsed = JSON.parse(
      toJson([{ a: 1 }], { title: 'Flash', references: { effectiveThresholdSeconds: 1.1 } }),
    );
    expect(parsed.meta.references.effectiveThresholdSeconds).toBe(1.1);
    expect(parsed.meta.app).toBe('CS2 Demo Analyser');
    expect(parsed.data).toEqual([{ a: 1 }]);
  });
});

describe('fileSlug', () => {
  it('tira acento, espaco e barra', () => {
    expect(fileSlug('Pré-aim e precisão / Round 3')).toBe('pre-aim-e-precisao-round-3');
  });
});

describe('wouldPrune — a previa na tela de configuracoes', () => {
  const m = (id: string, day: number, extra: Partial<MatchSummary> = {}) =>
    ({ matchId: id, ingestedAt: `2026-01-${String(day).padStart(2, '0')} 10:00:00`, pinned: false, bulkState: 'full', ...extra }) as MatchSummary;

  it('bate com a regra do backend: ordem de importacao, fixadas fora da conta', () => {
    const list = [m('a', 1, { pinned: true }), m('b', 2), m('c', 3), m('d', 4)];
    expect(wouldPrune(list, 1)).toBe(2);
    expect(wouldPrune(list, 0)).toBe(0);
  });

  it('partida ja podada nao conta de novo', () => {
    expect(wouldPrune([m('a', 1, { bulkState: 'pruned' }), m('b', 2)], 1)).toBe(0);
  });
});

describe('layoutTable', () => {
  const measure: Measure = (text) => text.length * 10;
  const table: TableData = {
    columns: ['jogador', 'kills', 'mapa'],
    rows: [
      ['ana', 20, 'de_cache'],
      ['bernardo', 3, 'de_nuke'],
    ],
  };

  it('coluna numerica alinha a direita; a primeira, nunca', () => {
    const l = layoutTable({ columns: ['round', 'dano'], rows: [[1, 90], [2, 12]] }, measure);
    expect(l.align).toEqual(['left', 'right']);
  });

  it('texto no meio da coluna tira o alinhamento a direita', () => {
    const l = layoutTable({ columns: ['a', 'b'], rows: [['x', 1], ['y', 'sem dado']] }, measure);
    expect(l.align[1]).toBe('left');
  });

  it('a coluna cresce ate a celula mais larga, cabecalho incluido', () => {
    const l = layoutTable(table, measure);
    expect(l.colW[0]).toBe(80);
    expect(l.colW[1]).toBe(50);
    expect(l.colX).toEqual([16, 110, 174]);
  });

  it('a altura e cabecalho + linhas + respiro', () => {
    const l = layoutTable(table, measure);
    expect(l.height).toBe(l.headerH + 2 * l.rowH + l.pad);
  });

  it('celula larga demais ganha reticencias e para no teto', () => {
    const nome = 'a'.repeat(60);
    const l = layoutTable({ columns: ['jogador'], rows: [[nome]] }, measure);
    expect(l.colW[0]).toBe(300);
    expect(l.cells[0]![0]!.endsWith('…')).toBe(true);
    expect(measure(l.cells[0]![0]!, '')).toBeLessThanOrEqual(300);
  });

  it('acima do limite de linhas, o que sobrou e declarado', () => {
    const rows = Array.from({ length: 12 }, (_, i) => [`p${i}`, i]);
    const l = layoutTable({ columns: ['jogador', 'n'], rows }, measure, { maxRows: 10 });
    expect(l.cells).toHaveLength(10);
    expect(l.omitted).toBe(2);
    expect(l.height).toBe(l.headerH + 11 * l.rowH + l.pad);
  });
});

describe('cellText', () => {
  it('lacuna vira travessao, e nao zero nem vazio', () => {
    expect(cellText(null)).toBe('—');
    expect(cellText(undefined)).toBe('—');
    expect(cellText('')).toBe('—');
    expect(cellText(Number.NaN)).toBe('—');
    expect(cellText(0)).toBe('0');
    expect(cellText(false)).toBe('nao');
  });
});

describe('wrapText — o rodape de procedencia cabe na imagem', () => {
  const measure: Measure = (text) => text.length * 10;

  it('quebra entre palavras, no limite', () => {
    expect(wrapText('uma frase de procedencia', 150, '', measure)).toEqual([
      'uma frase de',
      'procedencia',
    ]);
  });

  it('palavra maior que a linha fica inteira, e nao partida no meio', () => {
    expect(wrapText('effectiveThresholdSeconds: 1.1', 100, '', measure)).toEqual([
      'effectiveThresholdSeconds:',
      '1.1',
    ]);
  });
});

describe('referenceFooter', () => {
  it('leva os limiares para dentro da imagem, que nao tem tooltip', () => {
    expect(
      referenceFooter({ references: { tradeWindowSeconds: 5, lossBonus: [1400, 1900] } }),
    ).toEqual(['tradeWindowSeconds: 5', 'lossBonus: 1400 / 1900']);
  });

  it('sem referencia, sem rodape', () => {
    expect(referenceFooter(undefined)).toEqual([]);
  });
});
