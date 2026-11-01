import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { applyTheme, initialTheme } from './lib/theme';
import { PlanProvider } from './state/PlanContext';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/features.css';
import './styles/print.css';

applyTheme(initialTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <PlanProvider>
      <App />
    </PlanProvider>
  </StrictMode>,
);
