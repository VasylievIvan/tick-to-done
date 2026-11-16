import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { createGameSession, resolveSessionOptions } from './app/session.ts';
import { balance } from './config/balance.ts';
import { i18n } from './i18n/index.ts';
import { testRules } from './test/testRules.ts';
import { App } from './ui/App.tsx';
import './ui/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing');

// Browser tests build the game with the test rules; every other build plays the approved balance.
const rules = import.meta.env.VITE_RULES === 'test' ? testRules : balance;
const session = createGameSession(rules, resolveSessionOptions(window.location.search));

createRoot(container).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App session={session} />
    </I18nextProvider>
  </StrictMode>,
);
