import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initStorage } from './lib/storage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize storage seed
initStorage();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="Application Error Recovered">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
