import { createContext, use, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { GameStore, GameStoreState } from '../app/store.ts';
import type { GameState } from '../core/state.ts';

const GameStoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return <GameStoreContext value={store}>{children}</GameStoreContext>;
}

export function useGameStore(): GameStore {
  const store = use(GameStoreContext);
  if (!store) throw new Error('useGameStore must be used inside GameStoreProvider');
  return store;
}

/** Subscribes to a slice of the game state; the selector must return stable references for unchanged data. */
export function useGame<T>(selector: (game: GameState) => T): T {
  return useStore(useGameStore(), (state) => selector(state.game));
}

export function useDispatch(): GameStoreState['dispatch'] {
  return useStore(useGameStore(), (state) => state.dispatch);
}
