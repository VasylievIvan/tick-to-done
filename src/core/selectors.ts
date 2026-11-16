import {
  aiTickIntervalUsAt,
  aiWorkPowerAt,
  clickPowerAt,
  isUpgradeVisible,
  parallelTasksAt,
  spawnIntervalUsAt,
} from './economy.ts';
import { upgradeIds, type RepeatableUpgradeId, type Rules, type UpgradeId } from './rules.ts';
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

export function clickPower(state: GameState, rules: Rules): number {
  return clickPowerAt(rules, state.upgrades.levels.betterKeyboard);
}

export function aiWorkPower(state: GameState, rules: Rules): number {
  return aiWorkPowerAt(rules, state.upgrades.levels.aiWorkPower);
}

export function parallelTasks(state: GameState, rules: Rules): number {
  return parallelTasksAt(rules, state.upgrades.levels.parallelProcessing);
}

export function aiTickIntervalUs(state: GameState, rules: Rules): number {
  return aiTickIntervalUsAt(rules, state.upgrades.levels.aiTickSpeed);
}

export function spawnIntervalUs(state: GameState, rules: Rules): number {
  return spawnIntervalUsAt(rules, state.upgrades.levels.fasterBacklog);
}

export function reviewProgress(card: Card, rules: Rules): number {
  switch (card.review.status) {
    case 'none':
      return 0;
    case 'running':
      return card.review.elapsedUs / rules.review.durationUs;
    case 'accepted':
      return 1;
  }
}

export function timerProgress(state: GameState, rules: Rules, timer: TimerId): number {
  const { active, elapsedUs } = state.timers[timer];
  return active ? elapsedUs / timerIntervalUs(state, rules, timer) : 0;
}

export function visibleUpgrades(state: GameState, rules: Rules): UpgradeId[] {
  return upgradeIds.filter((id) => isUpgradeVisible(state, rules, id));
}

/** The value a repeatable upgrade changes at a given number of purchased levels. */
export function upgradeEffectAt(rules: Rules, id: RepeatableUpgradeId, level: number): number {
  switch (id) {
    case 'betterKeyboard':
      return clickPowerAt(rules, level);
    case 'aiWorkPower':
      return aiWorkPowerAt(rules, level);
    case 'aiTickSpeed':
      return aiTickIntervalUsAt(rules, level);
    case 'parallelProcessing':
      return parallelTasksAt(rules, level);
    case 'fasterBacklog':
      return spawnIntervalUsAt(rules, level);
  }
}
