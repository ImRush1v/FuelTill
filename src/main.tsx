import React from 'react';
import ReactDOM from 'react-dom/client';
import CashCalculator from './components/CashCalculator';
import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><CashCalculator /></React.StrictMode>);

// Register only the static application shell at this site's configured Vite base path.
// Never treat service-worker caching as secure financial data storage.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch(() => { /* Browser or policy may disable service workers. */ });
  });
}
