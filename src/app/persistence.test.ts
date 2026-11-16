import { describe, expect, it } from 'vitest';
import { TestSession } from '../core/testing.ts';
import { testRules } from '../test/testRules.ts';
import { loadGame, SAVE_KEY, SAVE_VERSION, saveGame, startAutosave, type SaveStorage } from './persistence.ts';
import { createGameStore } from './store.ts';

function memoryStorage(): SaveStorage & { readonly data: Map<string, string>; writes: number } {
  const data = new Map<string, string>();
  return {
    data,
    writes: 0,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      this.writes += 1;
      data.set(key, value);
    },
  };
}

const midGame = () => new TestSession(3).completeScriptedTasks().state;

describe('saved game', () => {
  it('restores exactly the state that was saved', () => {
    const storage = memoryStorage();
    const state = midGame();
    saveGame(storage, state);
    expect(loadGame(storage)).toEqual(state);
  });

  it('starts over instead of misreading a save of another version, broken JSON or a foreign value', () => {
    const storage = memoryStorage();
    expect(loadGame(storage)).toBeNull();
    storage.data.set(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION + 1, game: midGame() }));
    expect(loadGame(storage)).toBeNull();
    storage.data.set(SAVE_KEY, '{not json');
    expect(loadGame(storage)).toBeNull();
    storage.data.set(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, game: { timeUs: 5 } }));
    expect(loadGame(storage)).toBeNull();
  });

  it('keeps the game running when the storage refuses access', () => {
    const refusing: SaveStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadGame(refusing)).toBeNull();
    expect(() => {
      saveGame(refusing, midGame());
    }).not.toThrow();
    expect(loadGame(null)).toBeNull();
  });
});

describe('autosave', () => {
  function setup() {
    const storage = memoryStorage();
    const store = createGameStore(testRules, midGame());
    let tick: () => void = () => undefined;
    let leave: () => void = () => undefined;
    const stop = startAutosave({
      store,
      storage,
      every: (callback) => {
        tick = callback;
        return () => undefined;
      },
      onLeave: (callback) => {
        leave = callback;
        return () => undefined;
      },
    });
    return {
      storage,
      store,
      stop,
      tick: () => {
        tick();
      },
      leave: () => {
        leave();
      },
    };
  }

  it('writes on the timer only when the game changed since the last write', () => {
    const { storage, store, tick } = setup();
    tick();
    expect(storage.writes).toBe(1);
    tick();
    expect(storage.writes).toBe(1);
    store.getState().advance(1_000_000);
    tick();
    expect(storage.writes).toBe(2);
    expect(loadGame(storage)).toEqual(store.getState().game);
  });

  it('writes when the page is left', () => {
    const { storage, store, leave } = setup();
    store.getState().advance(500_000);
    leave();
    expect(loadGame(storage)).toEqual(store.getState().game);
  });

  it('writes a new game at once, so a reset survives an immediate reload', () => {
    const { storage, store } = setup();
    store.getState().newGame();
    const saved = loadGame(storage);
    expect(saved?.columns.todo).toEqual([1]);
    expect(saved?.economy.credits).toBe(0);
    expect(saved).toEqual(store.getState().game);
  });
});

describe('new game', () => {
  it('replaces the game and the journal with a fresh start', () => {
    const store = createGameStore(testRules, midGame());
    store.getState().dispatch({ type: 'moveCard', card: 4, from: 'todo', to: 'inProgress', index: 0 });
    store.getState().newGame();
    const { game, journal, generation } = store.getState();
    expect(game.economy.credits).toBe(0);
    expect(game.scenario.revealed.shop).toBe(false);
    expect(journal).toEqual([]);
    expect(generation).toBe(1);
  });
});
