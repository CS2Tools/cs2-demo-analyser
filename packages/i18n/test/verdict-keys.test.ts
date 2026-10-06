import { describe, expect, it } from 'vitest';
import { RULES } from '@cs2/core';
import { en } from '../src/locales/en.js';
import { ptBR } from '../src/locales/pt-BR.js';

type Nested = { [k: string]: string | Nested };

function lookup(catalog: Nested, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Nested)[part] : undefined),
    catalog,
  );
}

function emittableKeys(): string[] {
  const keys: string[] = [];
  for (const rule of RULES) {
    const tones = new Set(['good', 'neutral']);
    if (rule.variant) {

      tones.add(rule.variant(-1));
      tones.add(rule.variant(1));
    } else {
      tones.add('bad');
    }
    for (const tone of tones) {
      keys.push(`verdict.rules.${rule.id}.${tone}.title`, `verdict.rules.${rule.id}.${tone}.body`);
    }
    keys.push(`verdict.ruleName.${rule.id}`);
    if (rule.fixedReference) {
      keys.push(rule.fixedReference.labelKey, rule.fixedReference.rationaleKey);
    }
  }
  for (const ev of ['aimError', 'pitch', 'entryDeath', 'untraded', 'teamFlash']) {
    keys.push(`verdict.ev.${ev}`);
  }
  for (const s of ['critical', 'warning', 'positive', 'neutral']) keys.push(`verdict.severity.${s}`);
  for (const c of ['high', 'medium', 'low']) keys.push(`verdict.confidence.${c}`);
  keys.push('verdict.vsBaseline', 'verdict.evidence', 'verdict.sample');
  return keys;
}

describe('chaves de veredicto', () => {
  for (const [lang, catalog] of [['pt-BR', ptBR], ['en', en]] as const) {
    it(`toda chave emitida existe em ${lang}`, () => {
      const missing = emittableKeys().filter(
        (k) => typeof lookup(catalog as unknown as Nested, k) !== 'string',
      );
      expect(missing).toEqual([]);
    });
  }
});
