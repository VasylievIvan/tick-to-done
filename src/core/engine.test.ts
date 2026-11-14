import { produce, type Draft } from 'immer';
import { describe, expect, it } from 'vitest';
import { balance } from '../config/balance.ts';
import { advanceTime, applyCommand, type Command } from './engine.ts';
import { findInvariantViolations } from './invariants.ts';
import { createCard, createInitialState, type Card, type CardId, type ColumnId, type GameState } from './state.ts';
import { TestSession } from './testing.ts';

const REVIEW_US = balance.review.durationUs;

type CardSetup = Partial<Pick<Card, 'implementationDone' | 'reworkRequired' | 'reworkDone' | 'returnCount' | 'review'>> & {
  complexity?: number;
};

/** Builds a board directly: cards are placed in the given columns in order, with sequential numbers from 1. */
function boardWith(
  layout: Partial<Record<ColumnId, readonly CardSetup[]>>,
  tweak?: (draft: Draft<GameState>) => void,
): GameState {
  return produce(createInitialState(1), (draft) => {
    draft.cards = {};
    draft.columns = { todo: [], inProgress: [], review: [], done: [] };
    let number = 1;
    for (const column of ['todo', 'inProgress', 'review', 'done'] as const) {
      for (const setup of layout[column] ?? []) {
        const card: Draft<Card> = createCard(number, setup.complexity ?? 10, null);
        Object.assign(card, setup);
        if (column === 'done') card.doneAtUs = 0;
        draft.cards[number] = card;
        draft.columns[column].push(number);
        number += 1;
      }
    }
    draft.nextCardNumber = number;
    draft.scenario.revealed = { codeReview: true, done: true, balance: true, shop: true };
    draft.scenario.scriptedTasksIssued = balance.scenarioTasks.length;
    draft.scenario.spawnerEnabled = true;
    draft.economy.completedTasks = Math.max(draft.columns.done.length, balance.scenarioTasks.length);
    tweak?.(draft);
  });
}

const finished: CardSetup = { implementationDone: 10 };
const accepted: CardSetup = { implementationDone: 10, review: { status: 'accepted' } };
const reviewing: CardSetup = { implementationDone: 10, review: { status: 'running', elapsedUs: 0 } };

function move(card: CardId, from: ColumnId, to: ColumnId, index = 0): Command {
  return { type: 'moveCard', card, from, to, index };
}

describe('manual moves', () => {
  it('rejects every backward move', () => {
    const state = boardWith({ todo: [{}], inProgress: [finished], review: [accepted], done: [finished] });
    expect(findInvariantViolations(state)).toEqual([]);
    const backward: Command[] = [
      move(2, 'inProgress', 'todo'),
      move(3, 'review', 'inProgress'),
      move(3, 'review', 'todo'),
      move(4, 'done', 'review'),
      move(4, 'done', 'inProgress'),
      move(4, 'done', 'todo'),
    ];
    for (const command of backward) {
      const result = applyCommand(state, command);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
    }
  });

  it('rejects skipping a column', () => {
    const state = boardWith({ todo: [finished], inProgress: [finished] });
    expect(applyCommand(state, move(1, 'todo', 'review')).accepted).toBe(false);
    expect(applyCommand(state, move(2, 'inProgress', 'done')).accepted).toBe(false);
  });

  it('allows To Do → In Progress always, In Progress → Code Review only with the current work closed', () => {
    const state = boardWith({ todo: [{}], inProgress: [{ implementationDone: 9 }, finished] });
    expect(applyCommand(state, move(1, 'todo', 'inProgress')).accepted).toBe(true);
    expect(applyCommand(state, move(2, 'inProgress', 'review')).accepted).toBe(false);
    expect(applyCommand(state, move(3, 'inProgress', 'review')).accepted).toBe(true);
  });

  it('requires closed rework, not only closed implementation, to submit a returned card', () => {
    const returned: CardSetup = { implementationDone: 10, reworkRequired: 3, reworkDone: 2, returnCount: 1 };
    const state = boardWith({ inProgress: [returned] });
    expect(applyCommand(state, move(1, 'inProgress', 'review')).accepted).toBe(false);
    const fixed = applyCommand(state, { type: 'work', card: 1 }).state;
    expect(applyCommand(fixed, move(1, 'inProgress', 'review')).accepted).toBe(true);
  });

  it('allows Code Review → Done only for an accepted card', () => {
    const state = boardWith({ review: [reviewing, accepted] });
    expect(applyCommand(state, move(1, 'review', 'done')).accepted).toBe(false);
    expect(applyCommand(state, move(2, 'review', 'done')).accepted).toBe(true);
  });

  it('rejects a move whose source no longer holds the card', () => {
    const state = boardWith({ inProgress: [finished] });
    const submitted = applyCommand(state, move(1, 'inProgress', 'review')).state;
    expect(applyCommand(submitted, move(1, 'inProgress', 'review')).accepted).toBe(false);
    expect(applyCommand(state, move(99, 'todo', 'inProgress')).accepted).toBe(false);
  });

  it('places the card where it was dropped, and always at the bottom of Done', () => {
    const state = boardWith({ todo: [{}], inProgress: [{}, {}], review: [accepted], done: [finished, finished] });
    expect(applyCommand(state, move(1, 'todo', 'inProgress', 1)).state.columns.inProgress).toEqual([2, 1, 3]);
    expect(applyCommand(state, move(1, 'todo', 'inProgress', 0)).state.columns.inProgress).toEqual([1, 2, 3]);
    expect(applyCommand(state, move(1, 'todo', 'inProgress', 99)).state.columns.inProgress).toEqual([2, 3, 1]);
    expect(applyCommand(state, move(4, 'review', 'done', 0)).state.columns.done).toEqual([5, 6, 4]);
  });

  it('starts a full review on every entry into Code Review', () => {
    const session = new TestSession(boardWith({ inProgress: [finished] }));
    session.move(1, 'review');
    expect(session.card(1).review).toEqual({ status: 'running', elapsedUs: 0 });
    session.advance(REVIEW_US / 2);
    expect(session.card(1).review).toEqual({ status: 'running', elapsedUs: REVIEW_US / 2 });
  });
});

describe('reordering', () => {
  it('reorders To Do, In Progress and Code Review to the final index', () => {
    const state = boardWith({ todo: [{}, {}, {}] });
    const reorder = (index: number) =>
      applyCommand(state, { type: 'reorderCard', card: 1, column: 'todo', index }).state.columns.todo;
    expect(reorder(2)).toEqual([2, 3, 1]);
    expect(reorder(1)).toEqual([2, 1, 3]);
    expect(reorder(0)).toEqual([1, 2, 3]);

    const review = boardWith({ review: [reviewing, accepted] });
    const reordered = applyCommand(review, { type: 'reorderCard', card: 2, column: 'review', index: 0 });
    expect(reordered.accepted).toBe(true);
    expect(reordered.state.columns.review).toEqual([2, 1]);
    expect(reordered.state.cards[1]?.review).toEqual(review.cards[1]?.review);
  });

  it('does not let Done be reordered', () => {
    const state = boardWith({ done: [finished, finished] });
    expect(applyCommand(state, { type: 'reorderCard', card: 2, column: 'done', index: 0 }).accepted).toBe(false);
  });

  it('rejects a reorder in a column that no longer holds the card', () => {
    const state = boardWith({ todo: [{}, {}] });
    expect(applyCommand(state, { type: 'reorderCard', card: 1, column: 'inProgress', index: 0 }).accepted).toBe(false);
  });
});

describe('Work', () => {
  it('works only on unfinished cards in In Progress', () => {
    const state = boardWith({ todo: [{}], inProgress: [finished], review: [reviewing] });
    for (const card of [1, 2, 3]) expect(applyCommand(state, { type: 'work', card }).accepted).toBe(false);
  });

  it('loses click power beyond the remaining work instead of carrying it over', () => {
    const state = boardWith({ inProgress: [{ implementationDone: 8 }] }, (draft) => {
      draft.upgrades.levels.betterKeyboard = 3;
    });
    const worked = applyCommand(state, { type: 'work', card: 1 }).state;
    expect(worked.cards[1]).toMatchObject({ implementationDone: 10, reworkDone: 0, reworkRequired: 0 });
  });

  it('closes rework with the same Work button', () => {
    const state = boardWith({ inProgress: [{ implementationDone: 10, reworkRequired: 4, reworkDone: 1, returnCount: 1 }] });
    const worked = applyCommand(state, { type: 'work', card: 1 }).state;
    expect(worked.cards[1]).toMatchObject({ implementationDone: 10, reworkDone: 2, reworkRequired: 4 });
  });
});

describe('Code Review', () => {
  it('checks all cards in parallel and resolves simultaneous results top to bottom', () => {
    const session = new TestSession(boardWith({ review: [reviewing, reviewing, reviewing] }));
    const events = session.advance(REVIEW_US);
    const resolved = events.flatMap((event) =>
      event.type === 'reviewPassed' || event.type === 'reviewReturned' ? [event.card] : [],
    );
    expect(resolved).toEqual([1, 2, 3]);
  });

  it('returns a failed card to the bottom of To Do regardless of the generator limits', () => {
    const fullToDo = Array.from({ length: balance.spawner.toDoLimit }, () => ({}));
    const seed = Array.from({ length: 100 }, (_, index) => index + 1).find((candidate) => {
      const state = boardWith({ todo: fullToDo, review: [reviewing] }, (draft) => {
        draft.rng = createInitialState(candidate).rng;
      });
      return advanceTime(state, REVIEW_US).events.some((event) => event.type === 'reviewReturned');
    });
    expect(seed).toBeDefined();
    const session = new TestSession(
      boardWith({ todo: fullToDo, review: [reviewing] }, (draft) => {
        draft.rng = createInitialState(seed ?? 0).rng;
      }),
    );
    session.advance(REVIEW_US);
    expect(session.state.columns.todo).toEqual([1, 2, 3, 4, 5, 6]);
    expect(session.state.columns.todo.length).toBeGreaterThan(balance.spawner.toDoLimit);
  });
});

describe('Done', () => {
  it(`keeps the newest ${balance.done.maxCards} cards without touching Credits or statistics`, () => {
    const done = Array.from({ length: balance.done.maxCards }, () => finished);
    const session = new TestSession(boardWith({ review: [accepted], done }));
    const creditsBefore = session.state.economy.credits;
    const completedBefore = session.state.economy.completedTasks;

    expect(session.move(1, 'done')).toBe(true);
    expect(session.state.columns.done).toHaveLength(balance.done.maxCards);
    expect(session.state.columns.done[0]).toBe(3);
    expect(session.state.columns.done.at(-1)).toBe(1);
    expect(session.state.cards[2]).toBeUndefined();
    expect(session.events).toContainEqual({ type: 'doneCardRemoved', card: 2 });
    expect(session.state.economy.credits).toBe(creditsBefore + 20);
    expect(session.state.economy.completedTasks).toBe(completedBefore + 1);
  });

  it('pays the reward of the original complexity once, whatever the rework', () => {
    const reworked: CardSetup = {
      complexity: 10,
      implementationDone: 10,
      reworkRequired: 7,
      reworkDone: 7,
      returnCount: 2,
      review: { status: 'accepted' },
    };
    const session = new TestSession(boardWith({ review: [reworked] }));
    session.move(1, 'done');
    expect(session.state.economy.credits).toBe(20);
    expect(session.move(1, 'done')).toBe(false);
    expect(session.state.economy.credits).toBe(20);
  });
});

describe('time', () => {
  function stateWithWorkInFlight(): GameState {
    let state = boardWith({ inProgress: [finished, finished], review: [reviewing] });
    state = applyCommand(state, move(1, 'inProgress', 'review', 1)).state;
    state = advanceTime(state, 700_000).state;
    return applyCommand(state, move(2, 'inProgress', 'review', 0)).state;
  }

  function advanceInSlices(state: GameState, slices: readonly number[]) {
    let current = state;
    const events = [];
    for (const slice of slices) {
      const result = advanceTime(current, slice);
      current = result.state;
      events.push(...result.events);
    }
    return { state: current, events };
  }

  it('gives the same result however the time is sliced', () => {
    const start = stateWithWorkInFlight();
    const total = 5_000_000;
    const reference = advanceInSlices(start, [total]);
    const slicings = [
      [2_500_000, 2_500_000],
      [1, total - 1],
      Array.from({ length: 250 }, () => 20_000),
      [1_300_000, 1, 699_999, 999_999, 2_000_001],
      [100_000, 0, 4_900_000],
    ];
    for (const slices of slicings) {
      expect(slices.reduce((sum, slice) => sum + slice, 0)).toBe(total);
      expect(advanceInSlices(start, slices)).toEqual(reference);
    }
  });

  it('advances 100 ms like two advances of 50 ms', () => {
    const start = stateWithWorkInFlight();
    expect(advanceInSlices(start, [100_000])).toEqual(advanceInSlices(start, [50_000, 50_000]));
  });

  it('rejects a negative or fractional time step', () => {
    const state = createInitialState(1);
    expect(() => advanceTime(state, -1)).toThrow(RangeError);
    expect(() => advanceTime(state, 0.5)).toThrow(RangeError);
    expect(advanceTime(state, 0).state).toBe(state);
  });
});
