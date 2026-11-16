import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { testRules } from '../test/testRules.ts';
import { complexityRangeAt, complexityStep, upgradeCost } from './economy.ts';
import { stepUint32 } from './rng.ts';
import type { Rules } from './rules.ts';
import { complexityRange, visibleUpgrades } from './selectors.ts';
import { boardWith, TestSession } from './testing.ts';

/** The specification's level table is written for the range 10–50. */
const range10to50: Rules = {
  ...testRules,
  regularTaskComplexity: { ...testRules.regularTaskComplexity, min: 10, max: 50 },
};

function spawnerRunning(biggerTasks: number, seed: number, rules: Rules = testRules) {
  return new TestSession(
    boardWith(
      {},
      (draft) => {
        draft.rng = new TestSession(seed, rules).state.rng;
        draft.economy.credits = 1_000_000;
        draft.upgrades.discovered.biggerTasks = true;
        draft.upgrades.levels.biggerTasks = biggerTasks;
      },
      rules,
    ),
    rules,
  );
}

const spawnedComplexities = (session: TestSession) =>
  session.events.flatMap((event) =>
    event.type === 'cardCreated' && event.source === 'spawner' ? [session.card(event.card).originalComplexity] : [],
  );

describe('round complexity', () => {
  it('picks the largest 1, 2 or 5 × 10ⁿ not above half of the lower bound', () => {
    expect([1, 2, 3, 4, 9, 10, 19, 20, 39, 40, 99, 100, 160, 1280, 2560, 10_240].map(complexityStep)).toEqual([
      1, 1, 1, 2, 2, 5, 5, 10, 10, 20, 20, 50, 50, 500, 1000, 5000,
    ]);
  });

  it('matches the level table 0–10 of the specification for the range 10–50', () => {
    expect(Array.from({ length: 11 }, (_, level) => complexityRangeAt(range10to50, level))).toEqual([
      { min: 10, max: 50, step: 5 },
      { min: 20, max: 100, step: 10 },
      { min: 40, max: 200, step: 20 },
      { min: 80, max: 400, step: 20 },
      { min: 150, max: 800, step: 50 },
      { min: 300, max: 1600, step: 100 },
      { min: 600, max: 3200, step: 200 },
      { min: 1500, max: 6500, step: 500 },
      { min: 3000, max: 13_000, step: 1000 },
      { min: 6000, max: 26_000, step: 2000 },
      { min: 10_000, max: 50_000, step: 5000 },
    ]);
  });

  it('rounds a bound halfway between two multiples up', () => {
    const rules: Rules = { ...testRules, regularTaskComplexity: { min: 10, max: 25, rangeFactorPerBiggerTasksLevel: 3 } };
    // Level 1: 30–75, step 10; 75 lies halfway between 70 and 80.
    expect(complexityRangeAt(rules, 1)).toEqual({ min: 30, max: 80, step: 10 });
  });

  it('creates only multiples of the step inside the rounded bounds, for any level and seed', () => {
    fc.assert(
      fc.property(fc.nat({ max: 15 }), fc.nat(), (level, seed) => {
        const session = spawnerRunning(level, seed, range10to50);
        session.advance(testRules.spawner.intervalUs * testRules.spawner.toDoLimit);
        const { min, max, step } = complexityRangeAt(range10to50, level);
        const values = spawnedComplexities(session);
        expect(values).toHaveLength(testRules.spawner.toDoLimit);
        for (const value of values) {
          expect(value % step).toBe(0);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(max);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('reaches every multiple of the step in the range', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const session = spawnerRunning(1, seed, range10to50);
      session.advance(testRules.spawner.intervalUs * testRules.spawner.toDoLimit);
      for (const value of spawnedComplexities(session)) seen.add(value);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('spends exactly one draw of the generation stream per task', () => {
    const session = spawnerRunning(3, 1);
    const before = session.state.rng;
    session.advance(testRules.spawner.intervalUs);
    expect(session.state.rng).toEqual({ ...before, generation: stepUint32(before.generation).next });
  });
});

describe('Bigger Tasks', () => {
  it('doubles the whole range of new tasks per level and grows its price ×2 with the test rules', () => {
    expect([0, 1, 2].map((level) => complexityRangeAt(testRules, level))).toEqual([
      { min: 10, max: 30, step: 5 },
      { min: 20, max: 60, step: 10 },
      { min: 40, max: 120, step: 20 },
    ]);
    expect([0, 1, 2].map((level) => upgradeCost(testRules, 'biggerTasks', level))).toEqual([2000, 4000, 8000]);
  });

  it('has no level limit and needs no AI Developer', () => {
    const rich = new TestSession(
      boardWith({}, (draft) => {
        draft.economy.credits = Number.MAX_SAFE_INTEGER;
        draft.upgrades.discovered.biggerTasks = true;
        draft.upgrades.levels.biggerTasks = 12;
      }),
    );
    expect(rich.state.upgrades.owned.aiDeveloper).toBe(false);
    expect(visibleUpgrades(rich.state, testRules)).toContain('biggerTasks');
    expect(rich.command({ type: 'buyUpgrade', upgrade: 'biggerTasks' })).toBe(true);
    expect(complexityRange(rich.state, testRules)).toEqual(complexityRangeAt(testRules, 13));
  });

  it('changes only tasks created after the purchase, never the cards already on the board', () => {
    const session = new TestSession(
      boardWith(
        {
          todo: [{ complexity: 25 }],
          inProgress: [{ complexity: 15, implementationDone: 4 }],
          review: [{ complexity: 30, implementationDone: 30, review: { status: 'accepted' } }],
        },
        (draft) => {
          draft.economy.credits = 10_000;
          draft.upgrades.discovered.biggerTasks = true;
        },
      ),
    );
    const before = session.state.cards;
    expect(session.command({ type: 'buyUpgrade', upgrade: 'biggerTasks' })).toBe(true);
    expect(session.state.cards).toEqual(before);
    session.advance(testRules.spawner.intervalUs * 2);
    const values = spawnedComplexities(session);
    expect(values).toHaveLength(2);
    for (const value of values) expect(value % 10 === 0 && value >= 20 && value <= 60).toBe(true);
  });

  it('never changes the three scripted tasks', () => {
    const session = new TestSession(
      boardWith({ todo: [{ complexity: 10 }] }, (draft) => {
        draft.scenario.revealed = { codeReview: false, done: false, balance: false, shop: false };
        draft.scenario.scriptedTasksIssued = 1;
        draft.scenario.spawnerEnabled = false;
        draft.economy.completedTasks = 0;
        draft.upgrades.levels.biggerTasks = 4;
      }),
    );
    session.completeByHand(1);
    expect(session.card(2).originalComplexity).toBe(testRules.scenarioTasks[1]?.complexity);
    session.completeByHand(2);
    expect(session.card(3).originalComplexity).toBe(testRules.scenarioTasks[2]?.complexity);
  });
});
