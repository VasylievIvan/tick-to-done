import type { Draft } from 'immer';
import { balance } from '../config/balance.ts';
import { aiTickIntervalUsAt } from './economy.ts';
import { timerIds, type GameState, type TimerId } from './state.ts';

export function timerIntervalUs(state: GameState, timer: TimerId): number {
  switch (timer) {
    case 'aiDeveloper':
      return aiTickIntervalUsAt(state.upgrades.levels.aiTickSpeed);
    case 'autoAssign':
      return balance.moves.autoAssignIntervalUs;
    case 'autoSubmit':
      return balance.moves.autoSubmitIntervalUs;
    case 'autoComplete':
      return balance.moves.autoCompleteIntervalUs;
    case 'spawner':
      return balance.spawner.intervalUs;
  }
}

/** The single rule deciding whether a timer runs: it runs exactly while it has work to do. */
// TODO(stages 4, 6, 7): the generator, AI Developer and move automations get their work conditions in their stages.
export function timerHasWork(_state: GameState, _timer: TimerId): boolean {
  return false;
}

/**
 * Called after every command and every firing. A timer without work is stopped and reset; a timer that gets work
 * starts a full new interval. Missed firings therefore never exist.
 */
export function reconcileTimers(draft: Draft<GameState>): void {
  for (const id of timerIds) {
    const timer = draft.timers[id];
    if (!timerHasWork(draft, id)) {
      timer.active = false;
      timer.elapsedUs = 0;
    } else if (!timer.active) {
      timer.active = true;
      timer.elapsedUs = 0;
    }
  }
}
