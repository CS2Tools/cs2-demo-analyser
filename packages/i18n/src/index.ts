import i18next, { type i18n as I18nInstance, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ptBR } from './locales/pt-BR.js';
import { en } from './locales/en.js';

export type { Catalog } from './locales/pt-BR.js';
export { ptBR, en };

export const SUPPORTED_LOCALES = ['pt-BR', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

export const resources = {
  'pt-BR': { translation: ptBR },
  en: { translation: en },
} as const;

let instance: I18nInstance | null = null;

export function initI18n(locale: SupportedLocale = DEFAULT_LOCALE): I18nInstance {
  if (instance) return instance;
  void i18next.use(initReactI18next).init({
    resources: resources as unknown as Resource,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,

    keySeparator: '.',
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  instance = i18next;
  return i18next;
}

export function formatters(locale: SupportedLocale) {
  return {
    number: (v: number, digits = 1) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v),
    integer: (v: number) => new Intl.NumberFormat(locale).format(Math.round(v)),
    percent: (v: number, digits = 0) =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v),
    money: (v: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(v),
    date: (d: Date) =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(d),

    degrees: (v: number, digits = 1) =>
      `${v >= 0 ? '+' : ''}${new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v)}°`,
    milliseconds: (v: number) => `${new Intl.NumberFormat(locale).format(Math.round(v))} ms`,
  };
}
