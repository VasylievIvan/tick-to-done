import { describe, expect, it } from 'vitest';
import type { Rules } from '../core/rules.ts';
import { testRules } from '../test/testRules.ts';
import { simulate, type SimulationOptions } from './balanceSimulation.ts';

const options = (rules: Rules, limitSeconds: number): SimulationOptions => ({
  rules,
  seed: 7,
  strategy: 'cheapestFirst',
  player: { clicksPerSecond: 4, dragSeconds: 2, purchaseSeconds: 3 },
  limitSeconds,
  observeSecondsAfterFullAutomation: 60,
  segmentSeconds: 60,
  finalWindowSeconds: 60,
});

describe('balance simulation', () => {
  it('runs the whole length and reports one segment per interval', () => {
    const result = simulate(options(testRules, 300));
    expect(result.segments).toHaveLength(5);
    expect(result.segments.reduce((sum, segment) => sum + segment.purchases, 0)).toBe(result.purchaseOrder.length);
    expect(result.totalEarned).toBeGreaterThan(0);
  });

  it('buys the generator upgrades like any other repeatable upgrade', () => {
    const cheapGenerator: Rules = {
      ...testRules,
      upgrades: {
        ...testRules.upgrades,
        fasterBacklog: { ...testRules.upgrades.fasterBacklog, baseCost: 20 },
        biggerTasks: { ...testRules.upgrades.biggerTasks, baseCost: 20 },
      },
    };
    const result = simulate(options(cheapGenerator, 300));
    expect(result.purchaseOrder).toContain('fasterBacklog');
    expect(result.purchaseOrder).toContain('biggerTasks');
    expect(result.finalLevels.biggerTasks).toBeGreaterThan(0);
  });

  it('takes the rules as an argument: different rules give different runs, the same rules the same run', () => {
    const doubled: Rules = { ...testRules, rewardMultiplier: testRules.rewardMultiplier * 2 };
    expect(simulate(options(testRules, 120))).toEqual(simulate(options(testRules, 120)));
    expect(simulate(options(doubled, 120)).totalEarned).not.toBe(simulate(options(testRules, 120)).totalEarned);
  });
});
