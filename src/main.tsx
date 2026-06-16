import './lib/console-hook'
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@douyinfe/semi-ui/lib/es/_base/base.css';
import './styles/global.css';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import ThemeProvider from './components/ThemeProvider';
import { useSettingsStore } from './lib/settings-store';
import { useStore } from './lib';
import { loadAppSnapshot } from './lib/local-persistence';
import App from './App';

async function bootstrap() {
  const snapshot = await loadAppSnapshot();
  useSettingsStore.getState().hydrateSettings(snapshot.settings);
  (window as any).electronAPI?.setExternalLinkMode?.(snapshot.settings.externalLinkMode ?? 'system');
  useStore.getState().hydrateInstances(snapshot.instances, snapshot.currentInstanceId);

  const { locale } = snapshot.settings;
  i18n.changeLanguage(locale);
  document.documentElement.setAttribute('lang', locale);

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </I18nextProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
