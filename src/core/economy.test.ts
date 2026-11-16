import { describe, expect, it } from 'vitest';
import { testRules as rules } from '../test/testRules.ts';
import { upgradeIds } from './rules.ts';
import {
  aiTickIntervalUsAt,
  aiWorkPowerAt,
  clickPowerAt,
  isAiTickSpeedMaxedAt,
  isDiscoveryThresholdReached,
  parallelTasksAt,
  taskReward,
  upgradeCost,
} from './economy.ts';

const priceSeries = (id: Parameters<typeof upgradeCost>[1], count: number) =>
  Array.from({ length: count }, (_, level) => upgradeCost(rules, id, level));

describe('upgrade prices', () => {
  it('matches the Better Keyboard series from the rules: 30, 48, 77, 123, 197', () => {
    expect(priceSeries('betterKeyboard', 5)).toEqual([30, 48, 77, 123, 197]);
  });

  it('rounds the formula result, not the previous rounded price', () => {
    // ceil(180 × 1.7²) = ceil(520.2) = 521, while ceil(306 × 1.7) would give 521 too; the third step differs:
    // ceil(180 × 1.7³) = ceil(884.34) = 885, while ceil(521 × 1.7) = 886.
    expect(priceSeries('aiWorkPower', 4)).toEqual([180, 306, 521, 885]);
  });

  it('grows AI Tick Speed and Parallel Processing by their factors', () => {
    expect(priceSeries('aiTickSpeed', 3)).toEqual([240, 432, 778]);
    expect(priceSeries('parallelProcessing', 3)).toEqual([480, 1056, 2324]);
  });

  it('charges one-time upgrades their base price', () => {
    expect(upgradeCost(rules, 'aiDeveloper', 0)).toBe(120);
    expect(upgradeCost(rules, 'autoAssign', 0)).toBe(180);
    expect(upgradeCost(rules, 'autoSubmit', 0)).toBe(240);
    expect(upgradeCost(rules, 'autoComplete', 0)).toBe(300);
  });

  it('prices all four one-time automations at 840 Credits in total', () => {
    const total = (['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete'] as const)
      .map((id) => upgradeCost(rules, id, 0))
      .reduce((sum, cost) => sum + cost, 0);
    expect(total).toBe(840);
  });

  it('has exactly the upgrades of the v0.2 catalog', () => {
    expect([...upgradeIds].sort()).toEqual(
      [
        'aiDeveloper',
        'aiTickSpeed',
        'aiWorkPower',
        'autoAssign',
        'autoComplete',
        'autoSubmit',
        'betterKeyboard',
        'biggerTasks',
        'fasterBacklog',
        'parallelProcessing',
      ].sort(),
    );
  });

  it('starts every price at the base cost', () => {
    for (const id of upgradeIds) expect(upgradeCost(rules, id, 0)).toBe(rules.upgrades[id].baseCost);
  });
});

describe('level effects', () => {
  it('ClickPower = 1 + KeyboardLevels', () => {
    expect([0, 1, 2, 5].map((level) => clickPowerAt(rules, level))).toEqual([1, 2, 3, 6]);
  });

  it('AIWorkPower = 4 + WorkPowerLevels × 2', () => {
    expect([0, 1, 2, 5].map((level) => aiWorkPowerAt(rules, level))).toEqual([4, 6, 8, 14]);
  });

  it('ParallelTasks = 1 + ParallelLevels', () => {
    expect([0, 1, 2].map((level) => parallelTasksAt(rules, level))).toEqual([1, 2, 3]);
  });

  it('AITickInterval shrinks ×0.8 per level in exact microseconds and reaches 0.25 s on the seventh purchase', () => {
    expect(Array.from({ length: 8 }, (_, level) => aiTickIntervalUsAt(rules, level))).toEqual([
      1_000_000, 800_000, 640_000, 512_000, 409_600, 327_680, 262_144, 250_000,
    ]);
    expect(aiTickIntervalUsAt(rules, 20)).toBe(250_000);
  });

  it('makes AI Tick Speed unavailable only after the seventh purchase', () => {
    expect(Array.from({ length: 9 }, (_, level) => isAiTickSpeedMaxedAt(rules, level))).toEqual([
      false, false, false, false, false, false, false, true, true,
    ]);
  });
});

describe('reward', () => {
  it('pays OriginalComplexity × RewardMultiplier', () => {
    expect(taskReward(rules, 10)).toBe(20);
    expect(taskReward(rules, 15)).toBe(30);
    expect(taskReward(rules, 20)).toBe(40);
  });
});

describe('discovery threshold', () => {
  it('opens visibility at 50% of the base cost', () => {
    expect(isDiscoveryThresholdReached(rules, 14, 30)).toBe(false);
    expect(isDiscoveryThresholdReached(rules, 15, 30)).toBe(true);
    expect(isDiscoveryThresholdReached(rules, 89, 180)).toBe(false);
    expect(isDiscoveryThresholdReached(rules, 90, 180)).toBe(true);
  });
});
