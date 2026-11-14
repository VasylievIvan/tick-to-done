import type { Draft } from 'immer';
import { balance } from '../config/balance.ts';
import { unfinishedInProgressCount } from './counts.ts';
import { aiTickIntervalUsAt } from './economy.ts';
import { canSpawnRegularTask } from './spawner.ts';
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
export function timerHasWork(state: GameState, timer: TimerId): boolean {
  switch (timer) {
    case 'aiDeveloper':
      return state.upgrades.owned.aiDeveloper && unfinishedInProgressCount(state) > 0;
    // TODO(stage 7): move automations.
    case 'autoAssign':
    case 'autoSubmit':
    case 'autoComplete':
      return false;
    case 'spawner':
      return canSpawnRegularTask(state);
  }
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

/**
 * When a purchase changes a running timer's interval, the filled share of the indicator is kept: the elapsed time
 * is rescaled (rounded down to a microsecond), so the timer neither fires at the purchase nor jumps back.
 */
export function preserveTimerShare(draft: Draft<GameState>, timer: TimerId, intervalBeforeUs: number): void {
  const intervalAfterUs = timerIntervalUs(draft, timer);
  const state = draft.timers[timer];
  if (!state.active || intervalAfterUs === intervalBeforeUs) return;
  state.elapsedUs = Math.floor((state.elapsedUs * intervalAfterUs) / intervalBeforeUs);
}
