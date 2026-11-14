import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultNS, resources } from './resources.ts';

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: false,
  defaultNS,
  resources,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});
