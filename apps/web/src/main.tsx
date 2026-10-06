import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { initI18n, type SupportedLocale } from '@cs2/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import { App } from '@/app';
import { transport } from '@/lib/transport';
import '@/index.css';

const i18n = initI18n();

async function bootstrap(): Promise<void> {
  try {
    const settings = await transport.call('settings.get', {});
    const locale = settings.locale as SupportedLocale;
    if (locale && locale !== i18n.language) {
      await i18n.changeLanguage(locale);
      document.documentElement.lang = locale;
    }
  } catch {

  }
}

void bootstrap().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </I18nextProvider>
    </StrictMode>,
  );
});
