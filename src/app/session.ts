import { createInitialState } from '../core/state.ts';
import { browserFrames, browserVisibility, startTimeDriver } from './driver.ts';
import { createGameStore, type GameStore } from './store.ts';

export interface SessionOptions {
  readonly seed: number;
  readonly speed: number;
}

function systemSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

function positiveNumberParam(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Every page load is a new session with a fresh seed. The development build also accepts `?seed=` to replay a
 * session and `?speed=` to run game time faster; the production build ignores both.
 */
export function resolveSessionOptions(search: string): SessionOptions {
  if (!import.meta.env.DEV) return { seed: systemSeed(), speed: 1 };
  const params = new URLSearchParams(search);
  return {
    seed: positiveNumberParam(params, 'seed') ?? systemSeed(),
    speed: positiveNumberParam(params, 'speed') ?? 1,
  };
}

export interface GameSession {
  readonly store: GameStore;
  /** Starts feeding real time into the game; returns the function that stops it. */
  readonly start: () => () => void;
}

export function createGameSession(options: SessionOptions): GameSession {
  const store = createGameStore(createInitialState(options.seed));
  if (import.meta.env.DEV) exposeForDevelopment(store, options);
  return {
    store,
    start: () =>
      startTimeDriver({
        advance: (deltaUs) => {
          store.getState().advance(deltaUs);
        },
        frames: browserFrames,
        visibility: browserVisibility,
        speed: options.speed,
      }),
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
