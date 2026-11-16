import {
  aiTickIntervalUsAt,
  aiWorkPowerAt,
  boardLimitAt,
  clickPowerAt,
  complexityRangeAt,
  type ComplexityRange,
  isRepeatableUpgrade,
  isUpgradeVisible,
  parallelTasksAt,
  spawnIntervalUsAt,
  toDoLimitAt,
} from './economy.ts';
import { upgradeIds, type RepeatableUpgradeId, type Rules, type UpgradeId } from './rules.ts';
import type { Card, GameState, TimerId } from './state.ts';
import { timerIntervalUs } from './timers.ts';

export { canMoveCard, canReorderCard, canWork, columnOf } from './board.ts';
export { currentWorkRemaining, isUnfinished } from './cards.ts';
export { activeTasksCount, unfinishedInProgressCount } from './counts.ts';
export {
  boardLimitAt,
  canBuyUpgrade,
  complexityRangeAt,
  currentUpgradeCost,
  isRepeatableUpgrade,
  isUpgradeExhausted,
  isUpgradeVisible,
  taskReward,
  toDoLimitAt,
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

export function toDoLimit(state: GameState, rules: Rules): number {
  return toDoLimitAt(rules, state.upgrades.levels.parallelProcessing);
}

export function boardLimit(state: GameState, rules: Rules): number {
  return boardLimitAt(rules, state.upgrades.levels.parallelProcessing);
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

/** What the shop lists: visible upgrades, except one-time upgrades already bought. */
export function shopUpgrades(state: GameState, rules: Rules): UpgradeId[] {
  return visibleUpgrades(state, rules).filter((id) => isRepeatableUpgrade(id) || !state.upgrades.owned[id]);
}

export function complexityRange(state: GameState, rules: Rules): ComplexityRange {
  return complexityRangeAt(rules, state.upgrades.levels.biggerTasks);
}

/** The value a repeatable upgrade changes at a given number of purchased levels; Bigger Tasks changes a range. */
export function upgradeEffectAt(rules: Rules, id: Exclude<RepeatableUpgradeId, 'biggerTasks'>, level: number): number {
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
