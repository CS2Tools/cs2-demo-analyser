import { describe, expect, it } from 'vitest';
import { cleanName, formatDuration } from '../src/lib/format';

describe('cleanName', () => {
  it('tira nivel, verificado e selo de assinatura da Gamers Club', () => {
    expect(cleanName('⑮ ✓ ☆ jorge')).toBe('jorge');
    expect(cleanName('⑫ ✓ ★ TTV@FenixBladeCS')).toBe('TTV@FenixBladeCS');
    expect(cleanName('⑨ Ratola')).toBe('Ratola');
  });

  it('nick sem decoracao passa intacto', () => {
    expect(cleanName('FalleN')).toBe('FalleN');
    expect(cleanName('KSCERATO')).toBe('KSCERATO');
  });

  it('so tira do COMECO: simbolo no meio ou no fim e parte do nick', () => {
    expect(cleanName('ana ★ bia')).toBe('ana ★ bia');
    expect(cleanName('nrv-')).toBe('nrv-');
  });

  it('nick feito so de decoracao NAO vira vazio', () => {
    expect(cleanName('★ ☆ ✓')).toBe('★ ☆ ✓');
    expect(cleanName('   ')).toBe('');
  });

  it('nick que comeca com digito mantem o digito', () => {
    expect(cleanName('4ngel')).toBe('4ngel');
  });
});

describe('formatDuration', () => {
  it('segundos viram minuto:segundo com dois digitos', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(1871)).toBe('31:11');
  });

  it('sem duracao mostra travessao, e nao zero', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('negativo nao vira tempo negativo na tela', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});
