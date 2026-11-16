import type { Rules } from '../core/rules.ts';
import { createInitialState } from '../core/state.ts';
import { browserFrames, browserVisibility, startTimeDriver } from './driver.ts';
import { loadGame, startAutosave, type SaveStorage } from './persistence.ts';
import { createGameStore, type GameStore } from './store.ts';

export interface SessionOptions {
  /** A seed asked for in the address: replays a fresh session instead of continuing the saved one. */
  readonly seed: number | null;
  readonly speed: number;
}

function systemSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

function numberParam(params: URLSearchParams, name: string, isValid: (value: number) => boolean): number | null {
  const raw = params.get(name);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return isValid(value) ? value : null;
}

/**
 * The development build also accepts `?seed=` to replay a fresh session and `?speed=` to run game time faster; the
 * production build ignores both.
 */
export function resolveSessionOptions(search: string): SessionOptions {
  if (!import.meta.env.DEV) return { seed: null, speed: 1 };
  const params = new URLSearchParams(search);
  return {
    seed: numberParam(params, 'seed', (value) => Number.isSafeInteger(value) && value >= 0),
    speed: numberParam(params, 'speed', (value) => Number.isFinite(value) && value > 0) ?? 1,
  };
}

export interface GameSession {
  readonly store: GameStore;
  /** Starts feeding real time into the game and saving it; returns the function that stops both. */
  readonly start: () => () => void;
}

const AUTOSAVE_INTERVAL_MS = 2000;

function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The saved game continues where it was left; time while the page was closed is not counted. */
export function createGameSession(rules: Rules, options: SessionOptions): GameSession {
  const storage = browserStorage();
  const startGame = () => createInitialState(rules, systemSeed());
  const initial = options.seed === null ? (loadGame(storage) ?? startGame()) : createInitialState(rules, options.seed);
  const store = createGameStore(rules, initial, startGame);
  if (import.meta.env.DEV) exposeForDevelopment(store, options);
  return {
    store,
    start: () => {
      const stopDriver = startTimeDriver({
        advance: (deltaUs) => {
          store.getState().advance(deltaUs);
        },
        frames: browserFrames,
        visibility: browserVisibility,
        speed: options.speed,
      });
      const stopAutosave = startAutosave({
        store,
        storage,
        every: (callback) => {
          const handle = window.setInterval(callback, AUTOSAVE_INTERVAL_MS);
          return () => {
            window.clearInterval(handle);
          };
        },
        onLeave: (callback) => {
          const onHidden = () => {
            if (document.visibilityState === 'hidden') callback();
          };
          window.addEventListener('pagehide', callback);
          document.addEventListener('visibilitychange', onHidden);
          return () => {
            window.removeEventListener('pagehide', callback);
            document.removeEventListener('visibilitychange', onHidden);
          };
        },
      });
      return () => {
        stopDriver();
        stopAutosave();
      };
    },
  };
}

declare global {
  interface Window {
    /** Development build only: live state for inspection from the console and browser tests. */
    __vibecode?: { readonly store: GameStore; readonly options: SessionOptions };
  }
}

function exposeForDevelopment(store: GameStore, options: SessionOptions): void {
  window.__vibecode = { store, options };
}
