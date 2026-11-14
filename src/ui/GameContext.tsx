import { createContext, use, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
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

/** For selectors that build a new array each time: re-renders only when its items change. */
export function useGameList<T>(selector: (game: GameState) => readonly T[]): readonly T[] {
  return useStore(
    useGameStore(),
    useShallow((state: GameStoreState) => selector(state.game)),
  );
}

export function useHasJournal(): boolean {
  return useStore(useGameStore(), (state) => state.journal.length > 0);
}

export function useDispatch(): GameStoreState['dispatch'] {
  return useStore(useGameStore(), (state) => state.dispatch);
}

export function useJournal(): GameStoreState['journal'] {
  return useStore(useGameStore(), (state) => state.journal);
}
