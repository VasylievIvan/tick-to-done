import { render } from '@testing-library/react';
import type { i18n as I18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { createGameStore, type GameStore } from '../app/store.ts';
import type { GameState } from '../core/state.ts';
import { i18n } from '../i18n/index.ts';
import { GameStoreProvider } from '../ui/GameContext.tsx';

export function renderWithI18n(node: ReactNode, instance: I18n = i18n) {
  return render(<I18nextProvider i18n={instance}>{node}</I18nextProvider>);
}

export function renderGame(
  state: GameState,
  node: ReactNode,
  instance: I18n = i18n,
): { store: GameStore } & ReturnType<typeof render> {
  const store = createGameStore(state);
  const result = renderWithI18n(<GameStoreProvider store={store}>{node}</GameStoreProvider>, instance);
  return { store, ...result };
}
