import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { upgradeIds } from '../config/balance.ts';
import { advanceTime, applyCommand, type Command } from './engine.ts';
import type { GameEvent } from './events.ts';
import { findInvariantViolations, findTransitionViolations } from './invariants.ts';
import { columnIds, createInitialState, type GameState } from './state.ts';
import { boardWith } from './testing.ts';

/** Abstract player actions; card choices are indexes resolved against the state at the moment of acting. */
type Action =
  | { readonly kind: 'forward'; readonly pick: number; readonly index: number }
  | { readonly kind: 'anyMove'; readonly pick: number; readonly to: number; readonly index: number }
  | { readonly kind: 'reorder'; readonly pick: number; readonly index: number }
  | { readonly kind: 'work'; readonly pick: number; readonly clicks: number }
  | { readonly kind: 'buy'; readonly upgrade: number }
  | { readonly kind: 'wait'; readonly us: number };

const actionArbitrary: fc.Arbitrary<Action> = fc.oneof(
  { arbitrary: fc.record({ kind: fc.constant('forward' as const), pick: fc.nat(), index: fc.nat({ max: 12 }) }), weight: 4 },
  {
    arbitrary: fc.record({ kind: fc.constant('anyMove' as const), pick: fc.nat(), to: fc.nat({ max: 3 }), index: fc.nat({ max: 12 }) }),
    weight: 1,
  },
  { arbitrary: fc.record({ kind: fc.constant('reorder' as const), pick: fc.nat(), index: fc.nat({ max: 12 }) }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant('work' as const), pick: fc.nat(), clicks: fc.integer({ min: 1, max: 30 }) }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('buy' as const), upgrade: fc.nat({ max: upgradeIds.length - 1 }) }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant('wait' as const), us: fc.integer({ min: 0, max: 4_000_000 }) }), weight: 4 },
);

const forwardOf = { todo: 'inProgress', inProgress: 'review', review: 'done', done: 'done' } as const;

function cardAt(state: GameState, pick: number) {
  const placed = columnIds.flatMap((column) => state.columns[column].map((card) => ({ card, column })));
  return placed.length === 0 ? null : (placed[pick % placed.length] ?? null);
}

function toSteps(state: GameState, action: Action): (Command | { type: 'wait'; us: number })[] {
  if (action.kind === 'wait') return [{ type: 'wait', us: action.us }];
  if (action.kind === 'buy') return [{ type: 'buyUpgrade', upgrade: upgradeIds[action.upgrade] ?? 'betterKeyboard' }];
  const target = cardAt(state, action.pick);
  if (!target) return [];
  const { card, column } = target;
  switch (action.kind) {
    case 'forward':
      return [{ type: 'moveCard', card, from: column, to: forwardOf[column], index: action.index }];
    case 'anyMove':
      return [{ type: 'moveCard', card, from: column, to: columnIds[action.to] ?? 'todo', index: action.index }];
    case 'reorder':
      return [{ type: 'reorderCard', card, column, index: action.index }];
    case 'work':
      return Array.from({ length: action.clicks }, () => ({ type: 'work' as const, card }));
  }
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly violations: readonly string[];
}

function run(start: GameState, actions: readonly Action[]): Run {
  let state = start;
  const events: GameEvent[] = [];
  const violations: string[] = [...findInvariantViolations(start)];
  for (const action of actions) {
    for (const step of toSteps(state, action)) {
      const result = step.type === 'wait' ? advanceTime(state, step.us) : applyCommand(state, step);
      if ('accepted' in result && !result.accepted && result.state !== state) violations.push('rejected command changed the state');
      violations.push(...findTransitionViolations(state, result.state, result.events), ...findInvariantViolations(result.state));
      state = result.state;
      events.push(...result.events);
    }
  }
  return { state, events, violations };
}

const startArbitrary: fc.Arbitrary<GameState> = fc.oneof(
  fc.nat().map((seed) => createInitialState(seed)),
  fc
    .record({
      seed: fc.nat(),
      credits: fc.integer({ min: 0, max: 5000 }),
      owned: fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
      parallel: fc.nat({ max: 3 }),
      tickSpeed: fc.nat({ max: 7 }),
    })
    .map(({ seed, credits, owned, parallel, tickSpeed }) =>
      boardWith(
        {
          todo: [{}, { complexity: 25 }],
          inProgress: [{ complexity: 12 }, { complexity: 10, implementationDone: 10 }],
          review: [{ complexity: 10, implementationDone: 10, review: { status: 'accepted' } }],
        },
        (draft) => {
          draft.rng = createInitialState(seed).rng;
          draft.economy.credits = credits;
          draft.upgrades.owned = {
            aiDeveloper: owned[0] ?? false,
            autoAssign: owned[1] ?? false,
            autoSubmit: owned[2] ?? false,
            autoComplete: owned[3] ?? false,
          };
          draft.upgrades.levels.parallelProcessing = parallel;
          draft.upgrades.levels.aiTickSpeed = tickSpeed;
          for (const id of upgradeIds) draft.upgrades.discovered[id] = true;
        },
      ),
    ),
);

describe('properties on random command sequences', () => {
  it('keeps every invariant of section 4 after every step', () => {
    const seen = new Map<string, number>();
    fc.assert(
      fc.property(startArbitrary, fc.array(actionArbitrary, { maxLength: 60 }), (start, actions) => {
        const result = run(start, actions);
        expect(result.violations).toEqual([]);
        for (const event of result.events) {
          const key = event.type === 'cardMoved' ? `moved:${event.by}` : event.type;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
      }),
      { numRuns: 300 },
    );
    // The sequences must actually reach the interesting parts of the game, not only rejected commands.
    for (const kind of [
      'moved:player',
      'moved:autoAssign',
      'moved:autoSubmit',
      'moved:autoComplete',
      'reviewPassed',
      'reviewReturned',
      'taskCompleted',
      'upgradePurchased',
      'cardCreated',
      'interfaceRevealed',
    ]) {
      expect(seen.get(kind) ?? 0, kind).toBeGreaterThan(0);
    }
  });

  it('gives the same state and events for the same seed and the same inputs', () => {
    fc.assert(
      fc.property(startArbitrary, fc.array(actionArbitrary, { maxLength: 40 }), (start, actions) => {
        const first = run(start, actions);
        const second = run(start, actions);
        expect(second.state).toEqual(first.state);
        expect(second.events).toEqual(first.events);
      }),
      { numRuns: 100 },
    );
  });

  it('does not depend on how a stretch of time is sliced into frames', () => {
    fc.assert(
      fc.property(
        startArbitrary,
        fc.array(actionArbitrary, { maxLength: 30 }),
        fc.array(fc.integer({ min: 0, max: 700_000 }), { minLength: 1, maxLength: 25 }),
        (start, actions, slices) => {
          const { state } = run(start, actions);
          const total = slices.reduce((sum, slice) => sum + slice, 0);
          const whole = advanceTime(state, total);
          let sliced = state;
          const slicedEvents: GameEvent[] = [];
          for (const slice of slices) {
            const result = advanceTime(sliced, slice);
            sliced = result.state;
            slicedEvents.push(...result.events);
          }
          expect(sliced).toEqual(whole.state);
          expect(slicedEvents).toEqual(whole.events);
        },
      ),
      { numRuns: 150 },
    );
  });
});
