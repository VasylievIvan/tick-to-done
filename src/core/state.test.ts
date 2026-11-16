import { describe, expect, it } from 'vitest';
import { upgradeIds } from './rules.ts';
import { testRules } from '../test/testRules.ts';
import { createInitialState, timerIds } from './state.ts';

describe('initial state', () => {
  const state = createInitialState(testRules, 1);

  it('has a single Task 0001 of complexity 10 in To Do', () => {
    expect(state.columns).toEqual({ todo: [1], inProgress: [], review: [], done: [] });
    expect(Object.keys(state.cards)).toEqual(['1']);
    const card = state.cards[1];
    expect(card).toMatchObject({
      number: 1,
      titleKey: 'anotherTask',
      originalComplexity: 10,
      implementationDone: 0,
      reworkRequired: 0,
      reworkDone: 0,
      returnCount: 0,
      review: { status: 'none' },
      scriptedReview: 'pass',
      doneAtUs: null,
    });
    expect(state.nextCardNumber).toBe(2);
  });

  it('starts with 0 hidden Credits and no revealed interface beyond the two first columns', () => {
    expect(state.economy).toEqual({ credits: 0, completedTasks: 0, returnedReviews: 0, totalEarned: 0 });
    expect(state.scenario).toEqual({
      scriptedTasksIssued: 1,
      revealed: { codeReview: false, done: false, balance: false, shop: false },
      spawnerEnabled: false,
    });
  });

  it('has no automation, no purchases and no discovered upgrades', () => {
    expect(Object.values(state.upgrades.owned)).toEqual([false, false, false, false]);
    expect(Object.values(state.upgrades.levels)).toEqual([0, 0, 0, 0]);
    for (const id of upgradeIds) expect(state.upgrades.discovered[id]).toBe(false);
    for (const id of timerIds) expect(state.timers[id]).toEqual({ active: false, elapsedUs: 0 });
  });

  it('starts the session clock at zero and is serializable', () => {
    expect(state.timeUs).toBe(0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('derives the RNG state from the seed', () => {
    expect(createInitialState(testRules, 1).rng).toEqual(state.rng);
    expect(createInitialState(testRules, 2).rng).not.toEqual(state.rng);
  });
});
