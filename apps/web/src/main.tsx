import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './styles.css';
import './localization/i18n';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root element was not found.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
