import { describe, expect, it } from 'vitest';
import { en } from '../src/locales/en.js';
import { ptBR } from '../src/locales/pt-BR.js';

const SOURCES = ['gamers_club', 'faceit', 'valve_mm', 'hltv', 'unknown'];

const WIN_REASONS = [
  't_killed',
  'ct_killed',
  'bomb_exploded',
  'bomb_defused',
  'target_bombed',
  'target_saved',
  'hostages_rescued',
  'hostages_not_rescued',
];

const AGGS = ['count', 'sum', 'avg', 'median', 'max', 'min', 'share'];

const FAMILIES = ['aim', 'duels', 'utility', 'economy', 'combat'];

const catalogos = { 'pt-BR': ptBR, en } as unknown as Record<string, Record<string, never>>;

function valor(catalogo: Record<string, unknown>, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>(
    (atual, parte) => (atual as Record<string, unknown> | undefined)?.[parte],
    catalogo,
  );
}

describe('chaves dinamicas', () => {
  const casos: [string, string[]][] = [
    ['labels.source', SOURCES],
    ['labels.winReason', WIN_REASONS],
    ['agg', AGGS],
    ['verdict.family', FAMILIES],
  ];

  for (const [prefixo, valores] of casos) {
    for (const [idioma, catalogo] of Object.entries(catalogos)) {
      it(`${idioma}: ${prefixo} tem chave para todo valor possivel`, () => {
        const faltando = valores.filter((v) => typeof valor(catalogo, `${prefixo}.${v}`) !== 'string');
        expect(faltando, `sem traducao em ${idioma}: ${faltando.join(', ')}`).toEqual([]);
      });
    }
  }
});
