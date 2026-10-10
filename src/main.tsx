import React from 'react';
import ReactDOM from 'react-dom/client';
import CashCalculator from './components/CashCalculator';
import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><CashCalculator /></React.StrictMode>);

// Production HTTPS PWA support. Financial cloud actions still require a network connection.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{/* browser may block service workers */});});
}
