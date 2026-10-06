import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findRawStrings, isUiText } from './raw-text.js';

const SRC = 'apps/web/src';

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory()
      ? tsxFiles(path)
      : path.endsWith('.tsx')
        ? [path]
        : [];
  });
}

describe('texto de interface', () => {
  it('nenhum texto literal sobrou no JSX', () => {
    const achados = tsxFiles(SRC).flatMap((file) => findRawStrings(file));
    const linhas = achados.map((r) => `${r.file}:${r.line} ${JSON.stringify(r.text)}`);
    expect(linhas, `frases cruas:\n${linhas.join('\n')}`).toEqual([]);
  });
});

describe('isUiText', () => {
  it('texto que o usuario le e texto, de qualquer tamanho', () => {
    expect(isUiText('Rounds em que o jogador matou')).toBe(true);
    expect(isUiText('Site')).toBe(true);
    expect(isUiText('sim')).toBe(true);
  });

  it('jargao que nao se traduz fica de fora', () => {
    expect(isUiText('KAST')).toBe(false);
    expect(isUiText('K/D')).toBe(false);
    expect(isUiText('sv_cheats 1')).toBe(false);
  });

  it('codigo e tipo que o regex pega por engano nao contam', () => {
    expect(isUiText("b ? 'text-primary' : a")).toBe(false);
    expect(isUiText('& React.ComponentProps')).toBe(false);
    expect(isUiText("e.kind === 'kill' && e.tick")).toBe(false);
  });

  it('simbolo solto nao e texto', () => {
    expect(isUiText('—')).toBe(false);
    expect(isUiText(':')).toBe(false);
  });
});
