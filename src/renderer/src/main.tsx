import './assets/main.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { suppressKnownConsoleWarnings } from './lib/suppressConsoleWarnings';
import App from './App';

// Suppress known dependency-sourced console warnings
suppressKnownConsoleWarnings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
