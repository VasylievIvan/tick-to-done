import { describe, expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { TestSession } from './testing.ts';
import type { CardId } from './state.ts';

const REVIEW_US = 2_000_000;

interface ScenarioRun {
  session: TestSession;
  implementationClicks: number;
  firstReworkClicks: number;
  extraReworkClicks: number;
  firstReturnRework: number;
}

/** Passes a card in Code Review through its review, sending it back through rework as often as it returns. */
function reviewUntilAccepted(session: TestSession, id: CardId): number {
  let reworkClicks = 0;
  for (;;) {
    session.advance(REVIEW_US);
    if (session.card(id).review.status === 'accepted') return reworkClicks;
    expect(session.columnOf(id)).toBe('todo');
    expect(session.move(id, 'inProgress')).toBe(true);
    reworkClicks += session.workUntilFinished(id);
    expect(session.move(id, 'review')).toBe(true);
  }
}

function playScenario(seed: number): ScenarioRun {
  const session = new TestSession(seed);
  let implementationClicks = 0;

  for (const id of [1, 2] as const) {
    expect(session.move(id, 'inProgress')).toBe(true);
    implementationClicks += session.workUntilFinished(id);
    expect(session.move(id, 'review')).toBe(true);
    session.advance(REVIEW_US);
    expect(session.card(id).review.status).toBe('accepted');
    expect(session.move(id, 'done')).toBe(true);
  }

  expect(session.move(3, 'inProgress')).toBe(true);
  implementationClicks += session.workUntilFinished(3);
  expect(session.move(3, 'review')).toBe(true);
  session.advance(REVIEW_US);
  expect(session.columnOf(3)).toBe('todo');
  const firstReturnRework = session.card(3).reworkRequired;
  expect(session.move(3, 'inProgress')).toBe(true);
  const firstReworkClicks = session.workUntilFinished(3);
  expect(session.move(3, 'review')).toBe(true);
  const extraReworkClicks = reviewUntilAccepted(session, 3);
  expect(session.move(3, 'done')).toBe(true);

  return { session, implementationClicks, firstReworkClicks, extraReworkClicks, firstReturnRework };
}

describe('first scenario, steps 1–10', () => {
  it('reveals the interface step by step on the scripted path', () => {
    const session = new TestSession(1);
    const revealed = () => ({ ...session.state.scenario.revealed });

    // Step 1: To Do and In Progress, one task without buttons; the only action is dragging it to In Progress.
    expect(session.state.columns).toEqual({ todo: [1], inProgress: [], review: [], done: [] });
    expect(session.card(1).originalComplexity).toBe(10);
    expect(revealed()).toEqual({ codeReview: false, done: false, balance: false, shop: false });
    expect(session.work(1)).toBe(false);
    expect(session.move(1, 'review')).toBe(false);
    expect(session.move(1, 'inProgress')).toBe(true);

    // Steps 2–3: each Work click adds ClickPower = 1; the full bar disables Work and reveals Code Review.
    for (let click = 1; click < 10; click += 1) {
      expect(session.work(1)).toBe(true);
      expect(session.card(1).implementationDone).toBe(click);
      expect(session.state.scenario.revealed.codeReview).toBe(false);
      expect(session.move(1, 'review')).toBe(false);
    }
    expect(session.work(1)).toBe(true);
    expect(session.card(1).implementationDone).toBe(10);
    expect(session.work(1)).toBe(false);
    expect(revealed()).toEqual({ codeReview: true, done: false, balance: false, shop: false });

    // Steps 4–5: the player drags it to Code Review; the review starts by itself and lasts 2 seconds.
    expect(session.move(1, 'review')).toBe(true);
    expect(session.card(1).review).toEqual({ status: 'running', elapsedUs: 0 });
    session.advance(REVIEW_US - 1);
    expect(session.card(1).review).toEqual({ status: 'running', elapsedUs: REVIEW_US - 1 });
    expect(session.move(1, 'done')).toBe(false);
    const passed = session.advance(1);
    expect(passed).toEqual<GameEvent[]>([
      { type: 'reviewPassed', card: 1 },
      { type: 'interfaceRevealed', element: 'done' },
    ]);
    expect(session.columnOf(1)).toBe('review');

    // Steps 6–8: the player drags it to Done; the first payout reveals the balance; task 2 appears.
    expect(session.state.economy.credits).toBe(0);
    const completion = session.events.length;
    expect(session.move(1, 'done')).toBe(true);
    expect(session.events.slice(completion)).toEqual<GameEvent[]>([
      { type: 'cardMoved', card: 1, from: 'review', to: 'done', by: 'player' },
      { type: 'taskCompleted', card: 1, reward: 20, by: 'player' },
      { type: 'upgradeDiscovered', upgrade: 'betterKeyboard' },
      { type: 'interfaceRevealed', element: 'balance' },
      { type: 'cardCreated', card: 2, source: 'scenario' },
    ]);
    expect(session.state.economy).toMatchObject({ credits: 20, completedTasks: 1 });
    expect(revealed()).toEqual({ codeReview: true, done: true, balance: true, shop: false });
    expect(session.state.columns).toEqual({ todo: [2], inProgress: [], review: [], done: [1] });
    expect(session.card(2).originalComplexity).toBe(15);

    // Step 8: the second task repeats the cycle and its review also passes.
    expect(session.move(2, 'inProgress')).toBe(true);
    expect(session.workUntilFinished(2)).toBe(15);
    expect(session.move(2, 'review')).toBe(true);
    session.advance(REVIEW_US);
    expect(session.card(2).review.status).toBe('accepted');
    expect(session.move(2, 'done')).toBe(true);
    expect(session.state.economy.credits).toBe(50);
    expect(session.state.columns.todo).toEqual([3]);
    expect(session.card(3).originalComplexity).toBe(20);

    // Step 9: the third task's first review always returns it to To Do with 4–8 units of rework.
    expect(session.move(3, 'inProgress')).toBe(true);
    expect(session.workUntilFinished(3)).toBe(20);
    expect(session.move(3, 'review')).toBe(true);
    const returned = session.advance(REVIEW_US);
    const rework = session.card(3).reworkRequired;
    expect(returned).toEqual<GameEvent[]>([{ type: 'reviewReturned', card: 3, rework }]);
    expect(rework).toBeGreaterThanOrEqual(4);
    expect(rework).toBeLessThanOrEqual(8);
    expect(session.card(3)).toMatchObject({ implementationDone: 20, reworkDone: 0, returnCount: 1 });
    expect(session.state.columns.todo).toEqual([3]);
    expect(session.state.scenario.revealed.shop).toBe(false);

    expect(session.move(3, 'inProgress')).toBe(true);
    expect(session.workUntilFinished(3)).toBe(rework);
    expect(session.move(3, 'review')).toBe(true);
    reviewUntilAccepted(session, 3);

    // Step 10: completing the third task opens the shop and turns on the regular generator.
    expect(session.move(3, 'done')).toBe(true);
    expect(session.state.economy).toMatchObject({ credits: 90, completedTasks: 3 });
    expect(revealed()).toEqual({ codeReview: true, done: true, balance: true, shop: true });
    expect(session.state.scenario.spawnerEnabled).toBe(true);
    expect(session.state.columns).toEqual({ todo: [], inProgress: [], review: [], done: [1, 2, 3] });
  });

  it('takes 45 clicks of original work, 4–8 clicks of the first rework and pays 90 Credits on every seed', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const run = playScenario(seed);
      expect(run.implementationClicks).toBe(45);
      expect(run.firstReworkClicks).toBe(run.firstReturnRework);
      expect(run.firstReworkClicks).toBeGreaterThanOrEqual(4);
      expect(run.firstReworkClicks).toBeLessThanOrEqual(8);
      expect(run.session.state.economy.credits).toBe(90);
      expect(run.session.state.scenario.revealed.shop).toBe(true);
    }
  });

  it('uses the base return probability from the second review of the third task on', () => {
    const repeatedReturns = Array.from({ length: 60 }, (_, index) => playScenario(index + 1)).filter(
      (run) => run.extraReworkClicks > 0,
    );
    expect(repeatedReturns.length).toBeGreaterThan(0);
    expect(repeatedReturns.length).toBeLessThan(30);
  });
});

describe('repeated return', () => {
  it('adds the new rework to the required total and keeps the completed rework', () => {
    const seed = Array.from({ length: 200 }, (_, index) => index + 1).find((candidate) => {
      const run = playScenario(candidate);
      return run.session.events.filter((event) => event.type === 'reviewReturned' && event.card === 3).length >= 2;
    });
    expect(seed).toBeDefined();

    const session = new TestSession(seed);
    for (const id of [1, 2] as const) {
      session.move(id, 'inProgress');
      session.workUntilFinished(id);
      session.move(id, 'review');
      session.advance(REVIEW_US);
      session.move(id, 'done');
    }
    session.move(3, 'inProgress');
    session.workUntilFinished(3);
    session.move(3, 'review');
    session.advance(REVIEW_US);
    const first = session.card(3).reworkRequired;
    session.move(3, 'inProgress');
    session.workUntilFinished(3);
    expect(session.card(3)).toMatchObject({ reworkDone: first, reworkRequired: first });
    session.move(3, 'review');

    const events = session.advance(REVIEW_US);
    const secondReturn = events.find((event) => event.type === 'reviewReturned');
    if (secondReturn?.type !== 'reviewReturned') throw new Error('expected the second review to return the card');
    expect(session.card(3)).toMatchObject({
      implementationDone: 20,
      reworkDone: first,
      reworkRequired: first + secondReturn.rework,
      returnCount: 2,
    });
    expect(secondReturn.rework).toBeGreaterThanOrEqual(4);
    expect(secondReturn.rework).toBeLessThanOrEqual(8);

    session.move(3, 'inProgress');
    expect(session.workUntilFinished(3)).toBe(secondReturn.rework);
  });
});
