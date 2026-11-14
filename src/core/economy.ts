import type { Draft } from 'immer';
import { balance, type Fraction, type RepeatableUpgradeId, type UpgradeId, upgradeIds } from '../config/balance.ts';
import type { EventSink, MoveActor } from './events.ts';
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
  return balance.upgrades[id].kind === 'repeatable';
}

export function taskReward(originalComplexity: number): number {
  return originalComplexity * balance.rewardMultiplier;
}

/** `NextCost = ceil(BaseCost × GrowthFactor ^ PurchasedLevels)`; one-time upgrades always cost their base price. */
export function upgradeCost(id: UpgradeId, purchasedLevels: number): number {
  const definition = balance.upgrades[id];
  if (definition.kind === 'oneTime') return definition.baseCost;
  return scaleByPower(definition.baseCost, definition.costGrowth, purchasedLevels, 'ceil');
}

export function clickPowerAt(keyboardLevels: number): number {
  return balance.clickPower.base + keyboardLevels * balance.clickPower.perKeyboardLevel;
}

export function aiWorkPowerAt(workPowerLevels: number): number {
  return balance.ai.baseWorkPower + workPowerLevels * balance.ai.workPowerPerLevel;
}

export function parallelTasksAt(parallelLevels: number): number {
  return balance.ai.baseParallelTasks + parallelLevels * balance.ai.parallelTasksPerLevel;
}

/** `AITickInterval = max(0.25 s, 1 s × 0.8 ^ TickSpeedLevels)`, in whole microseconds. */
export function aiTickIntervalUsAt(tickSpeedLevels: number): number {
  const scaled = scaleByPower(
    balance.ai.baseTickIntervalUs,
    balance.ai.tickIntervalFactorPerLevel,
    tickSpeedLevels,
    'floor',
  );
  return Math.max(balance.ai.minTickIntervalUs, scaled);
}

/** Further AI Tick Speed purchases have no effect once the interval sits at its minimum. */
export function isAiTickSpeedMaxedAt(tickSpeedLevels: number): boolean {
  return aiTickIntervalUsAt(tickSpeedLevels) <= balance.ai.minTickIntervalUs;
}

export function isDiscoveryThresholdReached(credits: number, baseCost: number): boolean {
  const { numerator, denominator } = balance.discoveryThreshold;
  return credits * denominator >= baseCost * numerator;
}

export function payReward(draft: Draft<GameState>, card: Card, by: MoveActor, events: EventSink): void {
  const reward = taskReward(card.originalComplexity);
  draft.economy.credits += reward;
  draft.economy.completedTasks += 1;
  draft.economy.totalEarned += reward;
  events.push({ type: 'taskCompleted', card: card.number, reward, by });
  recordDiscoveries(draft, events);
}

/** A reached threshold is remembered: later spending never hides an upgrade again. */
export function recordDiscoveries(draft: Draft<GameState>, events: EventSink): void {
  for (const id of upgradeIds) {
    if (draft.upgrades.discovered[id]) continue;
    if (!isDiscoveryThresholdReached(draft.economy.credits, balance.upgrades[id].baseCost)) continue;
    draft.upgrades.discovered[id] = true;
    events.push({ type: 'upgradeDiscovered', upgrade: id });
  }
}

export function upgradeLevel(state: GameState, id: UpgradeId): number {
  if (isRepeatableUpgrade(id)) return state.upgrades.levels[id];
  return state.upgrades.owned[id] ? 1 : 0;
}

/** Visible: the shop is open, the 50% threshold was ever reached, and AI upgrades also need AI Developer. */
export function isUpgradeVisible(state: GameState, id: UpgradeId): boolean {
  if (!state.scenario.revealed.shop || !state.upgrades.discovered[id]) return false;
  return !balance.upgrades[id].requiresAiDeveloper || state.upgrades.owned.aiDeveloper;
}

/** A bought one-time upgrade and AI Tick Speed at its minimum interval stay in the shop but cannot be bought. */
export function isUpgradeExhausted(state: GameState, id: UpgradeId): boolean {
  if (id === 'aiTickSpeed') return isAiTickSpeedMaxedAt(state.upgrades.levels.aiTickSpeed);
  return !isRepeatableUpgrade(id) && state.upgrades.owned[id];
}

export function currentUpgradeCost(state: GameState, id: UpgradeId): number {
  return upgradeCost(id, upgradeLevel(state, id));
}

export function canBuyUpgrade(state: GameState, id: UpgradeId): boolean {
  return (
    isUpgradeVisible(state, id) &&
    !isUpgradeExhausted(state, id) &&
    state.economy.credits >= currentUpgradeCost(state, id)
  );
}

export function purchaseUpgrade(draft: Draft<GameState>, id: UpgradeId, events: EventSink): void {
  const cost = currentUpgradeCost(draft, id);
  draft.economy.credits -= cost;
  if (isRepeatableUpgrade(id)) draft.upgrades.levels[id] += 1;
  else draft.upgrades.owned[id] = true;
  events.push({ type: 'upgradePurchased', upgrade: id, cost });
}
