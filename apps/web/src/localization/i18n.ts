import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  fallbackLng: 'da',
  lng: 'da',
  resources: {
    da: {
      translation: {
        app: {
          name: 'Whistzilla',
        },
      },
    },
  },
});

export { i18n };
