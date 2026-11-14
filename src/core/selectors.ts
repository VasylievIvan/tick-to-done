import { balance } from '../config/balance.ts';
import { aiTickIntervalUsAt, aiWorkPowerAt, clickPowerAt, parallelTasksAt } from './economy.ts';
import type { Card, GameState, TimerId } from './state.ts';
import { timerIntervalUs } from './timers.ts';

export { canMoveCard, canReorderCard, canWork, columnOf } from './board.ts';
export { currentWorkRemaining, isUnfinished } from './cards.ts';
export { activeTasksCount, unfinishedInProgressCount } from './counts.ts';

export function clickPower(state: GameState): number {
  return clickPowerAt(state.upgrades.levels.betterKeyboard);
}

export function aiWorkPower(state: GameState): number {
  return aiWorkPowerAt(state.upgrades.levels.aiWorkPower);
}

export function parallelTasks(state: GameState): number {
  return parallelTasksAt(state.upgrades.levels.parallelProcessing);
}

export function aiTickIntervalUs(state: GameState): number {
  return aiTickIntervalUsAt(state.upgrades.levels.aiTickSpeed);
}

export function reviewProgress(card: Card): number {
  switch (card.review.status) {
    case 'none':
      return 0;
    case 'running':
      return card.review.elapsedUs / balance.review.durationUs;
    case 'accepted':
      return 1;
  }
}

export function timerProgress(state: GameState, timer: TimerId): number {
  const { active, elapsedUs } = state.timers[timer];
  return active ? elapsedUs / timerIntervalUs(state, timer) : 0;
}
