import { balance, type Fraction, type UpgradeId } from '../config/balance.ts';

function scaleByPower(value: number, ratio: Fraction, exponent: number, rounding: 'ceil' | 'floor'): number {
  const numerator = BigInt(value) * BigInt(ratio.numerator) ** BigInt(exponent);
  const denominator = BigInt(ratio.denominator) ** BigInt(exponent);
  const quotient = rounding === 'ceil' ? (numerator + denominator - 1n) / denominator : numerator / denominator;
  return Number(quotient);
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
