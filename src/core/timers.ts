import type { Draft } from 'immer';
import { canAutoAssign, canAutoComplete, canAutoSubmit } from './automation.ts';
import { unfinishedInProgressCount } from './counts.ts';
import { aiTickIntervalUsAt, spawnIntervalUsAt } from './economy.ts';
import { canSpawnRegularTask } from './spawner.ts';
import type { Rules } from './rules.ts';
import { timerIds, type GameState, type TimerId } from './state.ts';

export function timerIntervalUs(state: GameState, rules: Rules, timer: TimerId): number {
  switch (timer) {
    case 'aiDeveloper':
      return aiTickIntervalUsAt(rules, state.upgrades.levels.aiTickSpeed);
    case 'autoAssign':
      return rules.moves.autoAssignIntervalUs;
    case 'autoSubmit':
      return rules.moves.autoSubmitIntervalUs;
    case 'autoComplete':
      return rules.moves.autoCompleteIntervalUs;
    case 'spawner':
      return spawnIntervalUsAt(rules, state.upgrades.levels.fasterBacklog);
  }
}

/** The single rule deciding whether a timer runs: it runs exactly while it has work to do. */
export function timerHasWork(state: GameState, rules: Rules, timer: TimerId): boolean {
  switch (timer) {
    case 'aiDeveloper':
      return state.upgrades.owned.aiDeveloper && unfinishedInProgressCount(state) > 0;
    case 'autoAssign':
      return canAutoAssign(state, rules);
    case 'autoSubmit':
      return canAutoSubmit(state);
    case 'autoComplete':
      return canAutoComplete(state);
    case 'spawner':
      return canSpawnRegularTask(state, rules);
  }
}

/**
 * Called after every command and every firing. A timer without work is stopped and reset; a timer that gets work
 * starts a full new interval. Missed firings therefore never exist.
 */
export function reconcileTimers(draft: Draft<GameState>, rules: Rules): void {
  for (const id of timerIds) {
    const timer = draft.timers[id];
    if (!timerHasWork(draft, rules, id)) {
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
export function preserveTimerShare(
  draft: Draft<GameState>,
  rules: Rules,
  timer: TimerId,
  intervalBeforeUs: number,
): void {
  const intervalAfterUs = timerIntervalUs(draft, rules, timer);
  const state = draft.timers[timer];
  if (!state.active || intervalAfterUs === intervalBeforeUs) return;
  state.elapsedUs = Math.floor((state.elapsedUs * intervalAfterUs) / intervalBeforeUs);
}
