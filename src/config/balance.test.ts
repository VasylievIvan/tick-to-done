import { describe, expect, it } from 'vitest';
import { aiTickIntervalUsAt, upgradeCost } from '../core/economy.ts';
import type { Rules, UpgradeId } from '../core/rules.ts';
import { visibleUpgrades } from '../core/selectors.ts';
import { TestSession } from '../core/testing.ts';
import { balance } from './balance.ts';

/*
 * The only test that knows the approved balance. Numbers are copied by hand from docs/v0.1/prototype.md, section
 * "Стартовая экономика Prototype v0.1": the documentation lives outside git and is not read by tests. A balance
 * change updates the specification, src/config/balance.ts and this file together, in one commit.
 */

const s = (seconds: number) => seconds * 1_000_000;

const specification: Rules = {
  initialCredits: 0,
  rewardMultiplier: 2,
  taskTitleKey: 'anotherTask',
  scenarioTasks: [
    { complexity: 10, firstReview: 'pass' },
    { complexity: 15, firstReview: 'pass' },
    { complexity: 20, firstReview: 'return' },
  ],
  regularTaskComplexity: { min: 10, max: 30 },
  spawner: { intervalUs: s(3), toDoLimit: 5, boardLimit: 10 },
  clickPower: { base: 1, perKeyboardLevel: 1 },
  ai: {
    baseWorkPower: 4,
    workPowerPerLevel: 2,
    baseTickIntervalUs: s(1),
    tickIntervalFactorPerLevel: { numerator: 4, denominator: 5 },
    minTickIntervalUs: s(0.25),
    baseParallelTasks: 1,
    parallelTasksPerLevel: 1,
  },
  moves: { autoAssignIntervalUs: s(1), autoSubmitIntervalUs: s(1), autoCompleteIntervalUs: s(1) },
  review: {
    durationUs: s(2),
    returnProbability: { numerator: 15, denominator: 100 },
    reworkFactor: { min: { numerator: 1, denominator: 5 }, max: { numerator: 2, denominator: 5 } },
  },
  done: { maxCards: 5 },
  discoveryThreshold: { numerator: 1, denominator: 2 },
  upgrades: {
    betterKeyboard: { baseCost: 30, costGrowth: { numerator: 8, denominator: 5 }, requiresAiDeveloper: false },
    aiDeveloper: { baseCost: 120, requiresAiDeveloper: false },
    autoAssign: { baseCost: 180, requiresAiDeveloper: false },
    autoSubmit: { baseCost: 240, requiresAiDeveloper: false },
    autoComplete: { baseCost: 300, requiresAiDeveloper: false },
    aiWorkPower: { baseCost: 180, costGrowth: { numerator: 17, denominator: 10 }, requiresAiDeveloper: true },
    aiTickSpeed: { baseCost: 240, costGrowth: { numerator: 9, denominator: 5 }, requiresAiDeveloper: true },
    parallelProcessing: { baseCost: 480, costGrowth: { numerator: 11, denominator: 5 }, requiresAiDeveloper: true },
  },
};

const prices = (id: UpgradeId, count: number) =>
  Array.from({ length: count }, (_, level) => upgradeCost(balance, id, level));

describe('approved balance matches the specification', () => {
  it('has every number of the starting economy table', () => {
    expect(balance).toEqual(specification);
  });

  it('pays 90 Credits for the three scripted tasks and opens the shop with Better Keyboard, AI Developer and Auto Assign', () => {
    const session = new TestSession(1, balance).completeScriptedTasks();
    expect(session.state.economy.credits).toBe(90);
    expect(visibleUpgrades(session.state, balance)).toEqual(['betterKeyboard', 'aiDeveloper', 'autoAssign']);
  });

  it('prices the first five Better Keyboard levels at 30, 48, 77, 123, 197', () => {
    expect(prices('betterKeyboard', 5)).toEqual([30, 48, 77, 123, 197]);
  });

  it('prices the four one-time automations at 840 Credits in total', () => {
    const total = (['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete'] as const)
      .map((id) => upgradeCost(balance, id, 0))
      .reduce((sum, cost) => sum + cost, 0);
    expect(total).toBe(840);
  });

  it('reaches the 0.25 s AI tick on the seventh AI Tick Speed purchase', () => {
    expect(aiTickIntervalUsAt(balance, 6)).toBeGreaterThan(s(0.25));
    expect(aiTickIntervalUsAt(balance, 7)).toBe(s(0.25));
  });
});
