import { describe, expect, it } from 'vitest';
import type { UtilityThrow } from '@cs2/contract';
import {
  DEFAULT_FILTERS,
  filterThrows,
  hadEffect,
  isFiltered,
} from '../src/components/analysis/throw-filters';

const t = (p: Partial<UtilityThrow>): UtilityThrow => ({
  grenadeId: 1,
  roundNum: 1,
  steamId: 'ana',
  kind: 'he',
  side: 'T',
  throwPx: 0, throwPy: 0, detPx: 0, detPy: 0, split: 0,
  damage: 0, enemiesHit: 0, enemiesBlinded: 0, blindSeconds: 0, bestBlindSeconds: 0,
  ...p,
});

const he = t({ grenadeId: 1, kind: 'he', damage: 40, enemiesHit: 1 });
const heFraca = t({ grenadeId: 2, kind: 'he', damage: 6, enemiesHit: 1 });
const flash = t({ grenadeId: 3, kind: 'flash', enemiesBlinded: 2, blindSeconds: 3, bestBlindSeconds: 2.2 });
const flashFraca = t({ grenadeId: 4, kind: 'flash', enemiesBlinded: 1, blindSeconds: 0.4, bestBlindSeconds: 0.4 });
const smoke = t({ grenadeId: 5, kind: 'smoke' });
const decoy = t({ grenadeId: 6, kind: 'decoy' });
const todas = [he, heFraca, flash, flashFraca, smoke, decoy];

const ids = (list: UtilityThrow[]) => list.map((g) => g.grenadeId);

describe('filterThrows', () => {
  it('sem filtro, o mapa mostra tudo — decoy incluida', () => {
    expect(ids(filterThrows(todas, DEFAULT_FILTERS))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('o limiar de dano nao apaga as flashes', () => {
    const r = filterThrows(todas, { ...DEFAULT_FILTERS, minDamage: 30 });
    expect(ids(r)).toEqual([1, 3, 4, 5, 6]);
  });

  it('o limiar de cegueira nao apaga as HE', () => {
    const r = filterThrows(todas, { ...DEFAULT_FILTERS, minBlindSeconds: 1.1 });
    expect(ids(r)).toEqual([1, 2, 3, 5, 6]);
  });

  it('nenhum limiar toca smoke nem decoy: nao ha o que medir nelas', () => {
    const r = filterThrows(todas, {
      ...DEFAULT_FILTERS, minDamage: 999, minBlindSeconds: 999, minEnemies: 9,
    });
    expect(ids(r)).toEqual([5, 6]);
  });

  it('"so as que funcionaram" pede efeito medido, e por isso tira smoke e decoy', () => {
    const r = filterThrows(todas, { ...DEFAULT_FILTERS, effectiveOnly: true });
    expect(ids(r)).toEqual([1, 2, 3, 4]);
  });

  it('inimigos minimos vale para HE, molotov e flash', () => {
    const r = filterThrows(todas, { ...DEFAULT_FILTERS, minEnemies: 2 });
    expect(ids(r)).toEqual([3, 5, 6]);
  });

  it('lado e jogador continuam valendo para todos os tipos', () => {
    const outro = t({ grenadeId: 7, side: 'CT', steamId: 'bruno' });
    const lista = [...todas, outro];
    expect(ids(filterThrows(lista, { ...DEFAULT_FILTERS, side: 'CT' }))).toEqual([7]);
    expect(ids(filterThrows(lista, { ...DEFAULT_FILTERS, steamId: 'bruno' }))).toEqual([7]);
  });

  it('tipo desligado some, mesmo tendo funcionado', () => {
    const r = filterThrows(todas, { ...DEFAULT_FILTERS, kinds: ['flash'] });
    expect(ids(r)).toEqual([3, 4]);
  });
});

describe('hadEffect', () => {
  it('efeito e dano em inimigo OU inimigo cegado', () => {
    expect(hadEffect(he)).toBe(true);
    expect(hadEffect(flashFraca)).toBe(true);
    expect(hadEffect(smoke)).toBe(false);
  });
});

describe('isFiltered', () => {
  it('so os tipos nao contam como filtro: eles sao a legenda do mapa', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, kinds: ['he'] })).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, side: 'CT' })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, minBlindSeconds: 0.5 })).toBe(true);
  });
});
