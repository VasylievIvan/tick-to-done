import { describe, expect, it } from 'vitest';
import { testRules } from '../test/testRules.ts';
import { activeTasksCount } from './counts.ts';
import { advanceTime } from './engine.ts';
import { boardWith, TestSession, type CardSetup } from './testing.ts';

const SPAWN_US = testRules.spawner.intervalUs;
const { toDoLimit, boardLimit } = testRules.spawner;

const created = (session: TestSession) =>
  session.events.filter((event) => event.type === 'cardCreated' && event.source === 'spawner');

describe('regular generator', () => {
  it('stays off during the scripted tasks', () => {
    const session = new TestSession(1);
    session.advance(SPAWN_US * 10);
    expect(created(session)).toEqual([]);
    expect(session.state.timers.spawner).toEqual({ active: false, elapsedUs: 0 });
  });

  it('creates the first regular card after a full SpawnInterval from the third task reaching Done', () => {
    const session = new TestSession(1).completeScriptedTasks();
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 0 });
    session.advance(SPAWN_US - 1);
    expect(session.state.columns.todo).toEqual([]);
    session.advance(1);
    expect(session.state.columns.todo).toEqual([4]);
    expect(session.card(4)).toMatchObject({ titleKey: 'anotherTask', scriptedReview: null, implementationDone: 0 });
    expect(session.events.at(-1)).toEqual({ type: 'cardCreated', card: 4, source: 'spawner' });
  });

  it('keeps creating a card every SpawnInterval, at the bottom of To Do, with numbers in sequence', () => {
    const session = new TestSession(2).completeScriptedTasks();
    session.advance(SPAWN_US * 3);
    expect(session.state.columns.todo).toEqual([4, 5, 6]);
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 0 });
  });

  it('draws complexity uniformly among the multiples of the step 5 from 10 to 30', () => {
    const complexities = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = new TestSession(seed).completeScriptedTasks();
      session.advance(SPAWN_US * toDoLimit);
      for (const id of session.state.columns.todo) complexities.add(session.card(id).originalComplexity);
    }
    expect([...complexities].sort((a, b) => a - b)).toEqual([10, 15, 20, 25, 30]);
  });

  it('stops and resets at ToDoLimit, then starts a full new interval once a place frees up', () => {
    const session = new TestSession(3).completeScriptedTasks();
    session.advance(SPAWN_US * toDoLimit);
    expect(session.state.columns.todo).toHaveLength(toDoLimit);
    expect(session.state.timers.spawner).toEqual({ active: false, elapsedUs: 0 });

    session.advance(SPAWN_US * 10);
    expect(session.state.columns.todo).toHaveLength(toDoLimit);
    expect(session.state.timers.spawner).toEqual({ active: false, elapsedUs: 0 });

    const top = session.state.columns.todo[0] ?? 0;
    session.move(top, 'inProgress');
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 0 });
    session.advance(SPAWN_US - 1);
    expect(session.state.columns.todo).toHaveLength(toDoLimit - 1);
    session.advance(1);
    expect(session.state.columns.todo).toHaveLength(toDoLimit);
  });

  it('does not keep missed generations: a stop of any length gives exactly one card per interval afterwards', () => {
    const session = new TestSession(4).completeScriptedTasks();
    session.advance(SPAWN_US * toDoLimit + 60_000_000);
    const before = created(session).length;
    session.move(session.state.columns.todo[0] ?? 0, 'inProgress');
    session.move(session.state.columns.todo[0] ?? 0, 'inProgress');
    session.advance(SPAWN_US);
    expect(created(session).length).toBe(before + 1);
  });

  it('stops at BoardLimit even with room in To Do, counting finished and accepted cards but not Done', () => {
    const ready: CardSetup = { implementationDone: 10 };
    const accepted: CardSetup = { implementationDone: 10, review: { status: 'accepted' } };
    const done = Array.from({ length: testRules.done.maxCards }, (): CardSetup => ({ implementationDone: 10 }));
    const full = boardWith({
      todo: [{}],
      inProgress: [ready, ready, ready, {}],
      review: [accepted, accepted, accepted, accepted, accepted],
      done,
    });
    expect(activeTasksCount(full)).toBe(boardLimit);
    expect(full.columns.todo.length).toBeLessThan(toDoLimit);
    expect(full.timers.spawner).toEqual({ active: false, elapsedUs: 0 });
    expect(advanceTime(full, testRules, SPAWN_US * 5).events.filter((event) => event.type === 'cardCreated')).toEqual([]);

    const session = new TestSession(full);
    session.move(6, 'done');
    expect(activeTasksCount(session.state)).toBe(boardLimit - 1);
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 0 });
    session.advance(SPAWN_US);
    expect(created(session)).toHaveLength(1);
    expect(activeTasksCount(session.state)).toBe(boardLimit);
  });

  it('starts when there is one free place under BoardLimit regardless of Done', () => {
    const done = Array.from({ length: testRules.done.maxCards }, (): CardSetup => ({ implementationDone: 10 }));
    const almostFull = boardWith({
      inProgress: Array.from({ length: boardLimit - 1 }, (): CardSetup => ({})),
      done,
    });
    expect(almostFull.timers.spawner.active).toBe(true);
  });

  it('lets a review return push To Do above ToDoLimit while the generator stays stopped', () => {
    const reviewing: CardSetup = { implementationDone: 10, review: { status: 'running', elapsedUs: 0 } };
    const fullToDo = Array.from({ length: toDoLimit }, (): CardSetup => ({}));
    let returnedSeed: number | undefined;
    for (let seed = 1; seed <= 200 && returnedSeed === undefined; seed += 1) {
      const state = boardWith({ todo: fullToDo, review: [reviewing] }, (draft) => {
        draft.rng = new TestSession(seed).state.rng;
      });
      if (advanceTime(state, testRules, testRules.review.durationUs).events.some((event) => event.type === 'reviewReturned')) {
        returnedSeed = seed;
      }
    }
    expect(returnedSeed).toBeDefined();

    const session = new TestSession(
      boardWith({ todo: fullToDo, review: [reviewing] }, (draft) => {
        draft.rng = new TestSession(returnedSeed).state.rng;
      }),
    );
    session.advance(testRules.review.durationUs);
    expect(session.state.columns.todo).toHaveLength(toDoLimit + 1);
    session.advance(SPAWN_US * 3);
    expect(session.state.columns.todo).toHaveLength(toDoLimit + 1);
    expect(created(session)).toEqual([]);
  });
});
