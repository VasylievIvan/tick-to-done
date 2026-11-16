import type { Draft } from 'immer';
import type { EventSink, MoveActor } from './events.ts';
import {
  repeatableUpgradeIds,
  type Fraction,
  type RepeatableUpgradeId,
  type Rules,
  type UpgradeId,
  upgradeIds,
} from './rules.ts';
import type { Card, GameState } from './state.ts';

const scaledCache = new Map<string, number>();

/** Prices and intervals are read every frame but change only on purchase, so exact results are cached by input. */
function scaleByPower(value: number, ratio: Fraction, exponent: number, rounding: 'ceil' | 'floor'): number {
  const key = `${value}:${ratio.numerator}/${ratio.denominator}:${exponent}:${rounding}`;
  const cached = scaledCache.get(key);
  if (cached !== undefined) return cached;
  const result = exactScaleByPower(value, ratio, exponent, rounding);
  scaledCache.set(key, result);
  return result;
}

function exactScaleByPower(value: number, ratio: Fraction, exponent: number, rounding: 'ceil' | 'floor'): number {
  const numerator = BigInt(value) * BigInt(ratio.numerator) ** BigInt(exponent);
  const denominator = BigInt(ratio.denominator) ** BigInt(exponent);
  const quotient = rounding === 'ceil' ? (numerator + denominator - 1n) / denominator : numerator / denominator;
  return Number(quotient);
}

export function isRepeatableUpgrade(id: UpgradeId): id is RepeatableUpgradeId {
  return (repeatableUpgradeIds as readonly UpgradeId[]).includes(id);
}

export function taskReward(rules: Rules, originalComplexity: number): number {
  return originalComplexity * rules.rewardMultiplier;
}

/** `NextCost = ceil(BaseCost × GrowthFactor ^ PurchasedLevels)`; one-time upgrades always cost their base price. */
export function upgradeCost(rules: Rules, id: UpgradeId, purchasedLevels: number): number {
  if (!isRepeatableUpgrade(id)) return rules.upgrades[id].baseCost;
  const definition = rules.upgrades[id];
  return scaleByPower(definition.baseCost, definition.costGrowth, purchasedLevels, 'ceil');
}

export function clickPowerAt(rules: Rules, keyboardLevels: number): number {
  return rules.clickPower.base + keyboardLevels * rules.clickPower.perKeyboardLevel;
}

export function aiWorkPowerAt(rules: Rules, workPowerLevels: number): number {
  return rules.ai.baseWorkPower + workPowerLevels * rules.ai.workPowerPerLevel;
}

export function parallelTasksAt(rules: Rules, parallelLevels: number): number {
  return rules.ai.baseParallelTasks + parallelLevels * rules.ai.parallelTasksPerLevel;
}

/** `AITickInterval = max(0.25 s, 1 s × 0.8 ^ TickSpeedLevels)`, in whole microseconds. */
export function aiTickIntervalUsAt(rules: Rules, tickSpeedLevels: number): number {
  const scaled = scaleByPower(
    rules.ai.baseTickIntervalUs,
    rules.ai.tickIntervalFactorPerLevel,
    tickSpeedLevels,
    'floor',
  );
  return Math.max(rules.ai.minTickIntervalUs, scaled);
}

/** Further AI Tick Speed purchases have no effect once the interval sits at its minimum. */
export function isAiTickSpeedMaxedAt(rules: Rules, tickSpeedLevels: number): boolean {
  return aiTickIntervalUsAt(rules, tickSpeedLevels) <= rules.ai.minTickIntervalUs;
}

/** `SpawnInterval = max(1 s, 2 s × 0.8 ^ FasterBacklogLevels)`, in whole microseconds. */
export function spawnIntervalUsAt(rules: Rules, fasterBacklogLevels: number): number {
  const { intervalUs, intervalFactorPerFasterBacklogLevel, minIntervalUs } = rules.spawner;
  const scaled = scaleByPower(intervalUs, intervalFactorPerFasterBacklogLevel, fasterBacklogLevels, 'floor');
  return Math.max(minIntervalUs, scaled);
}

export function isFasterBacklogMaxedAt(rules: Rules, fasterBacklogLevels: number): boolean {
  return spawnIntervalUsAt(rules, fasterBacklogLevels) <= rules.spawner.minIntervalUs;
}

export function isDiscoveryThresholdReached(rules: Rules, credits: number, baseCost: number): boolean {
  const { numerator, denominator } = rules.discoveryThreshold;
  return credits * denominator >= baseCost * numerator;
}

export function payReward(draft: Draft<GameState>, rules: Rules, card: Card, by: MoveActor, events: EventSink): void {
  const reward = taskReward(rules, card.originalComplexity);
  draft.economy.credits += reward;
  draft.economy.completedTasks += 1;
  draft.economy.totalEarned += reward;
  events.push({ type: 'taskCompleted', card: card.number, reward, by });
  recordDiscoveries(draft, rules, events);
}

/** A reached threshold is remembered: later spending never hides an upgrade again. */
export function recordDiscoveries(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  for (const id of upgradeIds) {
    if (draft.upgrades.discovered[id]) continue;
    if (!isDiscoveryThresholdReached(rules, draft.economy.credits, rules.upgrades[id].baseCost)) continue;
    draft.upgrades.discovered[id] = true;
    events.push({ type: 'upgradeDiscovered', upgrade: id });
  }
}

export function upgradeLevel(state: GameState, id: UpgradeId): number {
  if (isRepeatableUpgrade(id)) return state.upgrades.levels[id];
  return state.upgrades.owned[id] ? 1 : 0;
}

/** Visible: the shop is open, the 50% threshold was ever reached, and AI upgrades also need AI Developer. */
export function isUpgradeVisible(state: GameState, rules: Rules, id: UpgradeId): boolean {
  if (!state.scenario.revealed.shop || !state.upgrades.discovered[id]) return false;
  return !rules.upgrades[id].requiresAiDeveloper || state.upgrades.owned.aiDeveloper;
}

/** Bought one-time upgrades and speed-ups at their minimum interval stay in the shop but cannot be bought. */
export function isUpgradeExhausted(state: GameState, rules: Rules, id: UpgradeId): boolean {
  if (id === 'aiTickSpeed') return isAiTickSpeedMaxedAt(rules, state.upgrades.levels.aiTickSpeed);
  if (id === 'fasterBacklog') return isFasterBacklogMaxedAt(rules, state.upgrades.levels.fasterBacklog);
  return !isRepeatableUpgrade(id) && state.upgrades.owned[id];
}

export function currentUpgradeCost(state: GameState, rules: Rules, id: UpgradeId): number {
  return upgradeCost(rules, id, upgradeLevel(state, id));
}

export function canBuyUpgrade(state: GameState, rules: Rules, id: UpgradeId): boolean {
  return (
    isUpgradeVisible(state, rules, id) &&
    !isUpgradeExhausted(state, rules, id) &&
    state.economy.credits >= currentUpgradeCost(state, rules, id)
  );
}

export function purchaseUpgrade(draft: Draft<GameState>, rules: Rules, id: UpgradeId, events: EventSink): void {
  const cost = currentUpgradeCost(draft, rules, id);
  draft.economy.credits -= cost;
  if (isRepeatableUpgrade(id)) draft.upgrades.levels[id] += 1;
  else draft.upgrades.owned[id] = true;
  events.push({ type: 'upgradePurchased', upgrade: id, cost });
}
