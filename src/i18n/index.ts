import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../locales/en.json';
import zhTranslation from '../locales/zh.json';

i18n.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    'en-US': {
      translation: enTranslation,
    },
    'zh-CN': {
      translation: zhTranslation,
    },
  },
});

export default i18n;
