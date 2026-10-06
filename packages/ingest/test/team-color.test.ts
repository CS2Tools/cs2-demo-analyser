import { describe, expect, it } from 'vitest';
import { teamColorFrom } from '../src/pass-a.js';

describe('teamColorFrom', () => {
  it('o nome da cor passa, normalizado', () => {
    expect(teamColorFrom('blue')).toBe('blue');
    expect(teamColorFrom('Orange')).toBe('orange');
    expect(teamColorFrom(' green ')).toBe('green');
  });

  it('-1 e ausencia de cor, nao uma cor chamada -1', () => {
    expect(teamColorFrom('-1')).toBeNull();
  });

  it('vazio e ausente nao viram cor', () => {
    expect(teamColorFrom('')).toBeNull();
    expect(teamColorFrom(undefined)).toBeNull();
    expect(teamColorFrom(null)).toBeNull();
  });

  it('inteiro nao e aceito: o app nao adivinha qual cor e o 3', () => {
    expect(teamColorFrom(3)).toBeNull();
    expect(teamColorFrom(-1)).toBeNull();
  });
});
