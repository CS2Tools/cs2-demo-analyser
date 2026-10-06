import { describe, expect, it } from 'vitest';
import { en } from '../src/locales/en.js';
import { ptBR } from '../src/locales/pt-BR.js';

type Nested = { [k: string]: string | Nested };

function flatten(obj: Nested, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const flatPt = flatten(ptBR as unknown as Nested);
const flatEn = flatten(en as unknown as Nested);

describe('paridade de catalogos', () => {
  it('os dois idiomas tem exatamente o mesmo conjunto de chaves', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatPt).sort());
  });

  it('nenhuma traducao esta vazia', () => {
    for (const [k, v] of Object.entries(flatEn)) {
      expect(v.trim(), `chave vazia em en: ${k}`).not.toBe('');
    }
    for (const [k, v] of Object.entries(flatPt)) {
      expect(v.trim(), `chave vazia em pt-BR: ${k}`).not.toBe('');
    }
  });

  it('os placeholders de interpolacao batem entre os idiomas', () => {
    const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
    for (const key of Object.keys(flatPt)) {
      expect(vars(flatEn[key]!), `placeholders divergem em ${key}`).toEqual(
        vars(flatPt[key]!),
      );
    }
  });
});

describe('glossario: termos identicos, explicacoes diferentes', () => {
  const termos = Object.keys(flatPt)
    .filter((k) => k.startsWith('glossary.') && !k.endsWith('_desc'));

  it('existe pelo menos um termo no glossario', () => {
    expect(termos.length).toBeGreaterThan(5);
  });

  for (const key of termos) {
    it(`${key} e identico nos dois idiomas`, () => {
      expect(flatEn[key]).toBe(flatPt[key]);
    });
  }

  it('todo termo tem uma explicacao, e ela e traduzida', () => {
    for (const key of termos) {
      const desc = `${key}_desc`;
      expect(flatPt[desc], `falta explicacao para ${key}`).toBeDefined();
      expect(flatEn[desc]).toBeDefined();

      expect(flatEn[desc]).not.toBe(flatPt[desc]);
    }
  });
});
