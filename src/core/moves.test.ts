import type { Draft } from 'immer';
import { describe, expect, it } from 'vitest';
import { balance, type OneTimeUpgradeId } from '../config/balance.ts';
import type { GameEvent } from './events.ts';
import type { GameState } from './state.ts';
import { boardWith, TestSession, type CardSetup } from './testing.ts';

const MOVE_US = balance.moves.autoAssignIntervalUs;

function owning(ids: readonly OneTimeUpgradeId[], levels: Partial<GameState['upgrades']['levels']> = {}) {
  return (draft: Draft<GameState>) => {
    for (const id of ids) draft.upgrades.owned[id] = true;
    Object.assign(draft.upgrades.levels, levels);
  };
}

const fresh: CardSetup = { complexity: 20 };
const finished: CardSetup = { complexity: 10, implementationDone: 10 };
const accepted: CardSetup = { complexity: 10, implementationDone: 10, review: { status: 'accepted' } };
const reviewing: CardSetup = { complexity: 10, implementationDone: 10, review: { status: 'running', elapsedUs: 0 } };

const moves = (events: readonly GameEvent[]) =>
  events.flatMap((event) => (event.type === 'cardMoved' ? [`${event.by}:${event.card}:${event.from}>${event.to}`] : []));

describe('Auto Assign', () => {
  it('does nothing before it is bought', () => {
    const session = new TestSession(boardWith({ todo: [fresh] }));
    session.advance(MOVE_US * 3);
    expect(session.columnOf(1)).toBe('todo');
    expect(session.state.columns.inProgress).toEqual([]);
  });

  it('moves the top To Do card to the bottom of In Progress once per firing while a slot is free', () => {
    const session = new TestSession(boardWith({ todo: [fresh, fresh], inProgress: [finished] }, owning(['autoAssign'], { parallelProcessing: 1 })));
    expect(session.state.timers.autoAssign).toEqual({ active: true, elapsedUs: 0 });
    session.advance(MOVE_US - 1);
    expect(session.state.columns.todo).toEqual([1, 2]);
    expect(moves(session.advance(1))).toEqual(['autoAssign:1:todo>inProgress']);
    expect(session.state.columns.inProgress).toEqual([3, 1]);
    expect(moves(session.advance(MOVE_US))).toEqual(['autoAssign:2:todo>inProgress']);
    expect(session.state.columns.inProgress).toEqual([3, 1, 2]);
  });

  it('takes no task while the slots are taken, and restarts a full interval when one frees', () => {
    const almost: CardSetup = { complexity: 10, implementationDone: 9 };
    const session = new TestSession(boardWith({ todo: [fresh], inProgress: [almost] }, owning(['autoAssign'])));
    expect(session.state.timers.autoAssign).toEqual({ active: false, elapsedUs: 0 });
    session.advance(MOVE_US * 3);
    expect(session.columnOf(1)).toBe('todo');
    session.work(2);
    expect(session.state.timers.autoAssign).toEqual({ active: true, elapsedUs: 0 });
    session.advance(MOVE_US);
    expect(session.state.columns.inProgress).toEqual([2, 1]);
  });

  it('takes returned cards like any other', () => {
    const returned: CardSetup = { complexity: 20, implementationDone: 20, reworkRequired: 5, returnCount: 1 };
    const session = new TestSession(boardWith({ todo: [returned] }, owning(['autoAssign'])));
    session.advance(MOVE_US);
    expect(session.state.columns.inProgress).toEqual([1]);
  });
});

describe('Auto Submit', () => {
  it('sends the top finished card to the bottom of Code Review and starts its review', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh, finished, finished], review: [reviewing] }, owning(['autoSubmit'])));
    expect(moves(session.advance(MOVE_US))).toEqual(['autoSubmit:2:inProgress>review']);
    expect(session.state.columns.review).toEqual([4, 2]);
    expect(session.card(2).review).toEqual({ status: 'running', elapsedUs: 0 });
    expect(moves(session.advance(MOVE_US))).toEqual(['autoSubmit:3:inProgress>review']);
    expect(session.state.timers.autoSubmit).toEqual({ active: false, elapsedUs: 0 });
  });

  it('waits for closed rework, not only closed implementation', () => {
    const reworking: CardSetup = { complexity: 10, implementationDone: 10, reworkRequired: 3, returnCount: 1 };
    const session = new TestSession(boardWith({ inProgress: [reworking] }, owning(['autoSubmit'])));
    expect(session.state.timers.autoSubmit.active).toBe(false);
    session.advance(MOVE_US * 2);
    expect(session.state.columns.inProgress).toEqual([1]);
  });
});

describe('Auto Complete', () => {
  it('moves the top accepted card to Done and pays once', () => {
    const session = new TestSession(boardWith({ review: [reviewing, accepted, accepted] }, owning(['autoComplete'])));
    const credits = session.state.economy.credits;
    expect(moves(session.advance(MOVE_US))).toEqual(['autoComplete:2:review>done']);
    expect(session.state.economy.credits).toBe(credits + 20);
    expect(session.state.columns.done).toEqual([2]);
  });

  it('keeps Done at DoneMaxCards', () => {
    const done = Array.from({ length: balance.done.maxCards }, () => finished);
    const session = new TestSession(boardWith({ review: [accepted], done }, owning(['autoComplete'])));
    session.advance(MOVE_US);
    expect(session.state.columns.done).toHaveLength(balance.done.maxCards);
    expect(session.state.columns.done[0]).toBe(1);
  });
});

describe('timers', () => {
  it('run independently of each other and of the AI tick', () => {
    const session = new TestSession(
      boardWith({ todo: [fresh], inProgress: [finished], review: [accepted] }, owning(['autoAssign', 'autoSubmit', 'autoComplete'])),
    );
    session.advance(400_000);
    session.move(1, 'inProgress');
    expect(session.state.timers.autoAssign).toEqual({ active: false, elapsedUs: 0 });
    expect(session.state.timers.autoSubmit.elapsedUs).toBe(400_000);
    expect(session.state.timers.autoComplete.elapsedUs).toBe(400_000);
  });

  it('resolve simultaneous firings from the end of the pipeline to its start', () => {
    const state = boardWith(
      { todo: [fresh], inProgress: [finished, fresh], review: [reviewing, accepted] },
      owning(['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete'], { parallelProcessing: 1 }),
    );
    const synced = new TestSession(state);
    synced.advance(1_000_000);
    const events = synced.events;
    const order = events.map((event) =>
      event.type === 'cardMoved' ? event.by : event.type === 'reviewPassed' || event.type === 'reviewReturned' ? 'review' : event.type,
    );
    const firstReview = order.indexOf('review');
    const [complete, submit, assign] = (['autoComplete', 'autoSubmit', 'autoAssign'] as const).map((step) => order.indexOf(step));
    expect(firstReview).toBe(-1);
    expect([complete, submit, assign].every((index) => index !== undefined && index >= 0)).toBe(true);
    expect(complete).toBeLessThan(submit ?? -1);
    expect(submit).toBeLessThan(assign ?? -1);
    // The AI tick comes before Auto Assign: the assigned card gets no work from the same instant.
    expect(synced.card(3).implementationDone).toBe(4);
    expect(synced.columnOf(1)).toBe('inProgress');
    expect(synced.card(1).implementationDone).toBe(0);
  });

  it('put Review results before every automation when they coincide', () => {
    const halfway: CardSetup = { ...reviewing, review: { status: 'running', elapsedUs: balance.review.durationUs - MOVE_US } };
    const session = new TestSession(boardWith({ review: [halfway, accepted] }, owning(['autoComplete'])));
    session.advance(MOVE_US);
    const kinds = session.events.map((event) => event.type);
    const review = kinds.findIndex((kind) => kind === 'reviewPassed' || kind === 'reviewReturned');
    expect(review).toBeGreaterThanOrEqual(0);
    expect(review).toBeLessThan(kinds.indexOf('cardMoved'));
  });
});

describe('full automatic cycle', () => {
  it('runs on its own for half an hour of game time without a single player action', () => {
    const automated = owning(['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete']);
    for (const seed of [1, 2, 3]) {
      const session = new TestSession(seed).completeScriptedTasks();
      const base = session.state;
      const state = boardWith({}, (draft) => {
        draft.rng = base.rng;
        automated(draft);
      });
      const bot = new TestSession(state);
      for (let second = 0; second < 30 * 60; second += 1) bot.advance(1_000_000);
      const { completedTasks, credits, returnedReviews } = bot.state.economy;
      expect(completedTasks).toBeGreaterThan(200);
      expect(returnedReviews).toBeGreaterThan(0);
      expect(credits).toBeGreaterThan(completedTasks * 20);
      expect(bot.state.columns.done).toHaveLength(balance.done.maxCards);
      const moversSeen = new Set(bot.events.flatMap((event) => (event.type === 'cardMoved' ? [event.by] : [])));
      expect([...moversSeen].sort()).toEqual(['autoAssign', 'autoComplete', 'autoSubmit']);
    }
  });
});
