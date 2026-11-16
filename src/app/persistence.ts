import { oneTimeUpgradeIds, repeatableUpgradeIds, upgradeIds } from '../core/rules.ts';
import { columnIds, revealableElements, timerIds, type GameState } from '../core/state.ts';
import type { GameStore } from './store.ts';

/** The subset of Web Storage the save needs; tests pass an in-memory one. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'tick-to-done/save';
/** Bumped whenever the shape of GameState changes: an older save is then discarded, not misread. */
export const SAVE_VERSION = 1;

interface SaveFile {
  readonly version: number;
  readonly game: GameState;
}

type Shape = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Shape => typeof value === 'object' && value !== null;
const hasKeys = (value: unknown, keys: readonly string[], check: (item: unknown) => boolean): boolean =>
  isObject(value) && keys.every((key) => check(value[key]));
const isNumber = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): boolean => typeof value === 'boolean';

/** Guards against a save from another version or a hand-edited one; the rules are re-checked by the core on use. */
function looksLikeGameState(value: unknown): value is GameState {
  if (!isObject(value)) return false;
  const { upgrades, scenario, economy } = value;
  return (
    isNumber(value.timeUs) &&
    isNumber(value.nextCardNumber) &&
    hasKeys(value.rng, ['generation', 'review', 'rework'], isNumber) &&
    isObject(value.cards) &&
    hasKeys(value.columns, columnIds, (column) => Array.isArray(column) && column.every(isNumber)) &&
    hasKeys(economy, ['credits', 'completedTasks', 'returnedReviews', 'totalEarned'], isNumber) &&
    isObject(upgrades) &&
    hasKeys(upgrades.levels, repeatableUpgradeIds, isNumber) &&
    hasKeys(upgrades.owned, oneTimeUpgradeIds, isBoolean) &&
    hasKeys(upgrades.discovered, upgradeIds, isBoolean) &&
    hasKeys(value.timers, timerIds, (timer) => hasKeys(timer, ['elapsedUs'], isNumber) && hasKeys(timer, ['active'], isBoolean)) &&
    isObject(scenario) &&
    isNumber(scenario.scriptedTasksIssued) &&
    isBoolean(scenario.spawnerEnabled) &&
    hasKeys(scenario.revealed, revealableElements, isBoolean)
  );
}

/** Storage can be missing or refuse access (private mode, blocked site data): the game then simply does not save. */
export function loadGame(storage: SaveStorage | null): GameState | null {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw == null) return null;
    const file: unknown = JSON.parse(raw);
    if (!isObject(file) || file.version !== SAVE_VERSION || !looksLikeGameState(file.game)) return null;
    return file.game;
  } catch {
    return null;
  }
}

export function saveGame(storage: SaveStorage | null, game: GameState): void {
  const file: SaveFile = { version: SAVE_VERSION, game };
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // A full or blocked storage only costs the save, never the running game.
  }
}

export interface AutosaveOptions {
  readonly store: GameStore;
  readonly storage: SaveStorage | null;
  /** Calls the callback periodically; returns the function that stops it. */
  readonly every: (callback: () => void) => () => void;
  /** Calls the callback when the page is about to be hidden or closed; returns the function that stops it. */
  readonly onLeave: (callback: () => void) => () => void;
}

/**
 * Writes the game state when it changed since the last write: periodically, when the page is left, and right away
 * when a new game replaces the old one, so a reset survives an immediate reload.
 */
export function startAutosave({ store, storage, every, onLeave }: AutosaveOptions): () => void {
  let saved: GameState | null = null;
  const flush = () => {
    const { game } = store.getState();
    if (game === saved) return;
    saveGame(storage, game);
    saved = game;
  };
  const stopTimer = every(flush);
  const stopLeave = onLeave(flush);
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.generation !== previous.generation) flush();
  });
  return () => {
    stopTimer();
    stopLeave();
    unsubscribe();
  };
}
