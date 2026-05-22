import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../lib/settings-store';
import { applyTheme, setupThemeListener } from '../lib/theme';
import i18n from '../i18n';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const settings = useSettingsStore((state) => state.settings);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  useEffect(() => {
    i18n.changeLanguage(settings.locale);
    document.documentElement.setAttribute('lang', settings.locale);
  }, [settings.locale]);

  useEffect(() => {
    cleanupRef.current = setupThemeListener(() => {
      return useSettingsStore.getState().settings;
    });

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return <>{children}</>;
}
