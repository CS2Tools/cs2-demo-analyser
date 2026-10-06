import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@cs2/i18n';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { transport } from '@/lib/transport';

const LABELS: Record<SupportedLocale, string> = {
  'pt-BR': 'PT',
  en: 'EN',
};

export function LocaleToggle() {
  const { i18n } = useTranslation();
  const current = (i18n.language as SupportedLocale) ?? 'pt-BR';

  const change = (next: string | undefined) => {
    if (!next || next === current) return;
    void i18n.changeLanguage(next);
    document.documentElement.lang = next;
    void transport.call('settings.set', { locale: next as SupportedLocale });
  };

  return (

    <ToggleGroup
      multiple={false}
      value={[current]}
      onValueChange={(value) => change(value[0] as string | undefined)}
      size="sm"
      variant="outline"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <ToggleGroupItem key={locale} value={locale} aria-label={locale}>
          {LABELS[locale]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
