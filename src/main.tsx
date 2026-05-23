import React from 'react';
import ReactDOM from 'react-dom/client';
import '@douyinfe/semi-ui/lib/es/_base/base.css';
import './styles/global.css';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import ThemeProvider from './components/ThemeProvider';
import { useSettingsStore } from './lib/settings-store';
import { useStore } from './lib';
import App from './App';

useSettingsStore.getState().loadSettings();
useStore.getState().loadInstances();

const loadedSettings = useSettingsStore.getState().settings;
console.log('[main.tsx] settings loaded:', JSON.stringify(loadedSettings));
console.log('[main.tsx] localStorage openclaw-settings raw:', localStorage.getItem('openclaw-settings'));
console.log('[main.tsx] localStorage openclaw-instances raw:', localStorage.getItem('openclaw-instances'));

const { locale } = loadedSettings;
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
