import { createStore, type StoreApi } from 'zustand/vanilla';
import { advanceTime, applyCommand, type Command } from '../core/engine.ts';
import type { GameEvent } from '../core/events.ts';
import type { GameState } from '../core/state.ts';

export interface GameStoreState {
  readonly game: GameState;
  /** Applies a player command at once; returns whether the core accepted it. */
  readonly dispatch: (command: Command) => boolean;
  readonly advance: (deltaUs: number) => void;
}

export type GameStore = StoreApi<GameStoreState>;

export type EventListener = (events: readonly GameEvent[]) => void;

export function createGameStore(initial: GameState, onEvents?: EventListener): GameStore {
  return createStore<GameStoreState>()((set, get) => ({
    game: initial,
    dispatch: (command) => {
      const result = applyCommand(get().game, command);
      if (!result.accepted) return false;
      set({ game: result.state });
      if (result.events.length > 0) onEvents?.(result.events);
      return true;
    },
    advance: (deltaUs) => {
      const result = advanceTime(get().game, deltaUs);
      if (result.state === get().game) return;
      set({ game: result.state });
      if (result.events.length > 0) onEvents?.(result.events);
    },
  }));
}
