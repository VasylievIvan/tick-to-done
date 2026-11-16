import { describe, expect, it } from 'vitest';
import { testRules } from '../test/testRules.ts';
import { activeTasksCount } from './counts.ts';
import { boardLimitAt, toDoLimitAt } from './economy.ts';
import { boardLimit, toDoLimit } from './selectors.ts';
import { boardWith, TestSession, type CardSetup } from './testing.ts';

const SPAWN_US = testRules.spawner.intervalUs;
const fresh = (count: number): CardSetup[] => Array.from({ length: count }, () => ({}));

/** AI Developer is owned and Parallel Processing is affordable, so the purchase is the only change. */
function withParallelOnSale(layout: Parameters<typeof boardWith>[0]) {
  return new TestSession(
    boardWith(layout, (draft) => {
      draft.economy.credits = 100_000;
      draft.upgrades.owned.aiDeveloper = true;
      draft.upgrades.discovered.parallelProcessing = true;
    }),
  );
}

const buyParallel = (session: TestSession) => session.command({ type: 'buyUpgrade', upgrade: 'parallelProcessing' });

const spawned = (session: TestSession) =>
  session.events.filter((event) => event.type === 'cardCreated' && event.source === 'spawner').length;

describe('generator limits grow with Parallel Processing', () => {
  it('adds 1 to ToDoLimit and 2 to BoardLimit per level', () => {
    expect([0, 1, 2, 3].map((level) => [toDoLimitAt(testRules, level), boardLimitAt(testRules, level)])).toEqual([
      [5, 10],
      [6, 12],
      [7, 14],
      [8, 16],
    ]);
  });

  it('restarts a generator stopped by a full To Do with a full interval right after the purchase', () => {
    const session = withParallelOnSale({ todo: fresh(5) });
    expect(session.state.timers.spawner).toEqual({ active: false, elapsedUs: 0 });

    expect(buyParallel(session)).toBe(true);
    expect(toDoLimit(session.state, testRules)).toBe(6);
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 0 });

    session.advance(SPAWN_US - 1);
    expect(spawned(session)).toBe(0);
    session.advance(1);
    expect(spawned(session)).toBe(1);
    expect(session.state.columns.todo).toHaveLength(6);
    expect(session.state.timers.spawner).toEqual({ active: false, elapsedUs: 0 });
    session.advance(SPAWN_US * 5);
    expect(spawned(session)).toBe(1);
  });

  it('restarts a generator stopped by a full board and fills it up to the new BoardLimit', () => {
    const session = withParallelOnSale({ todo: fresh(2), inProgress: fresh(8) });
    expect(activeTasksCount(session.state)).toBe(10);
    expect(session.state.timers.spawner.active).toBe(false);

    expect(buyParallel(session)).toBe(true);
    expect(boardLimit(session.state, testRules)).toBe(12);
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 0 });
    session.advance(SPAWN_US * 5);
    expect(spawned(session)).toBe(2);
    expect(activeTasksCount(session.state)).toBe(12);
    expect(session.state.timers.spawner.active).toBe(false);
  });

  it('still lets returns from Review pass both grown limits', () => {
    const reviewing: CardSetup = { implementationDone: 10, review: { status: 'running', elapsedUs: 0 } };
    const session = new TestSession(
      boardWith({ todo: fresh(6), review: [reviewing, reviewing, reviewing, reviewing, reviewing, reviewing] }, (draft) => {
        draft.upgrades.levels.parallelProcessing = 1;
      }),
      // Every review returns, so all six land in To Do at once.
      { ...testRules, review: { ...testRules.review, returnProbability: { numerator: 1, denominator: 1 } } },
    );
    expect(activeTasksCount(session.state)).toBe(12);
    session.advance(testRules.review.durationUs);
    expect(session.state.columns.todo).toHaveLength(12);
    expect(session.state.columns.todo.length).toBeGreaterThan(toDoLimit(session.state, session.rules));
    expect(session.state.timers.spawner.active).toBe(false);
  });
});
