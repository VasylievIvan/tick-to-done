import { balance, type RepeatableUpgradeId, type UpgradeId, upgradeIds } from '../config/balance.ts';
import {
  aiTickIntervalUsAt,
  aiWorkPowerAt,
  clickPowerAt,
  isUpgradeVisible,
  parallelTasksAt,
} from './economy.ts';
import type { Card, GameState, TimerId } from './state.ts';
import { timerIntervalUs } from './timers.ts';

export { canMoveCard, canReorderCard, canWork, columnOf } from './board.ts';
export { currentWorkRemaining, isUnfinished } from './cards.ts';
export { activeTasksCount, unfinishedInProgressCount } from './counts.ts';
export {
  canBuyUpgrade,
  currentUpgradeCost,
  isRepeatableUpgrade,
  isUpgradeExhausted,
  isUpgradeVisible,
  upgradeLevel,
} from './economy.ts';

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

export function visibleUpgrades(state: GameState): UpgradeId[] {
  return upgradeIds.filter((id) => isUpgradeVisible(state, id));
}

/** The value a repeatable upgrade changes at a given number of purchased levels. */
export function upgradeEffectAt(id: RepeatableUpgradeId, level: number): number {
  switch (id) {
    case 'betterKeyboard':
      return clickPowerAt(level);
    case 'aiWorkPower':
      return aiWorkPowerAt(level);
    case 'aiTickSpeed':
      return aiTickIntervalUsAt(level);
    case 'parallelProcessing':
      return parallelTasksAt(level);
  }
}
