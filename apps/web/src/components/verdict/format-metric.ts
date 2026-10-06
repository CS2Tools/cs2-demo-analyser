import type { VerdictWire } from '@cs2/contract';
import { formatters, type SupportedLocale } from '@cs2/i18n';

type Unit = VerdictWire['unit'];

export function formatMetric(value: number, unit: Unit, locale: SupportedLocale, signed = false): string {
  const f = formatters(locale);
  switch (unit) {
    case 'deg':
      return signed ? f.degrees(value) : `${f.number(value)}°`;
    case 'ratio':
      return f.percent(value);
    case 'seconds':
      return `${value > 0 && signed ? '+' : ''}${f.number(value)} s`;
    case 'dmg_per_1000':
      return f.integer(value);
    case 'adr':
      return f.number(value);
    case 'money':
      return f.money(value);
    case 'dmg_per_nade':
      return f.number(value);
  }
}

export function isSignedMetric(ruleId: string): boolean {
  return ruleId === 'aim.pitch_bias' || ruleId === 'utility.flash_net';
}
