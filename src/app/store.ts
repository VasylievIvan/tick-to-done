import { createStore, type StoreApi } from 'zustand/vanilla';
import { advanceTime, applyCommand, type Command } from '../core/engine.ts';
import type { GameEvent } from '../core/events.ts';
import type { Rules } from '../core/rules.ts';
import { createInitialState, type GameState } from '../core/state.ts';
import { appendToJournal, toJournalRecords, type JournalEntry } from './journal.ts';

export interface GameStoreState {
  /** Fixed for the whole session; the interface reads numbers such as the Review duration from here. */
  readonly rules: Rules;
  readonly game: GameState;
  /** Newest last, at most the technical limit. */
  readonly journal: readonly JournalEntry[];
  readonly journalWritten: number;
  /** Grows by one each time a new game replaces the current one. */
  readonly generation: number;
  /** Applies a player command at once; returns whether the core accepted it. */
  readonly dispatch: (command: Command) => boolean;
  readonly advance: (deltaUs: number) => void;
  /** Throws the current game away and starts from the very beginning. */
  readonly newGame: () => void;
}

export type GameStore = StoreApi<GameStoreState>;

export function createGameStore(
  rules: Rules,
  initial: GameState,
  startGame: () => GameState = () => createInitialState(rules, 0),
): GameStore {
  return createStore<GameStoreState>()((set, get) => {
    function publish(game: GameState, events: readonly GameEvent[]) {
      const { journal, journalWritten } = get();
      const records = toJournalRecords(events);
      set({
        game,
        journal: appendToJournal(journal, records, journalWritten),
        journalWritten: journalWritten + records.length,
      });
    }

    return {
      rules,
      game: initial,
      journal: [],
      journalWritten: 0,
      generation: 0,
      dispatch: (command) => {
        const result = applyCommand(get().game, rules, command);
        if (!result.accepted) return false;
        publish(result.state, result.events);
        return true;
      },
      advance: (deltaUs) => {
        const result = advanceTime(get().game, rules, deltaUs);
        if (result.state !== get().game) publish(result.state, result.events);
      },
      newGame: () => {
        set({ game: startGame(), journal: [], journalWritten: 0, generation: get().generation + 1 });
      },
    };
  });
}
