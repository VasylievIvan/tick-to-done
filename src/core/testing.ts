import { produce, type Draft } from 'immer';
import { expect } from 'vitest';
import { columnOf } from './board.ts';
import { applyCommand, advanceTime, type Command, type StepResult } from './engine.ts';
import type { GameEvent } from './events.ts';
import { findInvariantViolations, findTransitionViolations } from './invariants.ts';
import { currentWorkRemaining } from './cards.ts';
import type { Rules } from './rules.ts';
import { testRules } from '../test/testRules.ts';
import { createCard, createInitialState, type Card, type CardId, type ColumnId, type GameState } from './state.ts';
import { reconcileTimers } from './timers.ts';

/** Test driver over the public engine: checks every invariant after every step and keeps the event history. */
export class TestSession {
  state: GameState;
  readonly events: GameEvent[] = [];
  workClicks = 0;
  readonly rules: Rules;

  constructor(seedOrState: number | GameState = 1, rules: Rules = testRules) {
    this.rules = rules;
    this.state = typeof seedOrState === 'number' ? createInitialState(rules, seedOrState) : seedOrState;
    expect(findInvariantViolations(this.state, rules)).toEqual([]);
  }

  private record(result: StepResult): readonly GameEvent[] {
    expect(findTransitionViolations(this.rules, this.state, result.state, result.events)).toEqual([]);
    expect(findInvariantViolations(result.state, this.rules)).toEqual([]);
    this.state = result.state;
    this.events.push(...result.events);
    return result.events;
  }

  command(command: Command): boolean {
    const result = applyCommand(this.state, this.rules, command);
    if (!result.accepted) {
      expect(result.state).toBe(this.state);
      expect(result.events).toEqual([]);
      return false;
    }
    this.record(result);
    if (command.type === 'work') this.workClicks += 1;
    return true;
  }

  advance(deltaUs: number): readonly GameEvent[] {
    return this.record(advanceTime(this.state, this.rules, deltaUs));
  }

  card(id: CardId): Card {
    const card = this.state.cards[id];
    if (!card) throw new Error(`Card ${id} is not on the board`);
    return card;
  }

  columnOf(id: CardId): ColumnId | null {
    return columnOf(this.state, id);
  }

  /** Moves a card from where it currently is; drops at the bottom unless an index is given. */
  move(id: CardId, to: ColumnId, index?: number): boolean {
    const from = this.columnOf(id);
    if (from === null) return false;
    return this.command({ type: 'moveCard', card: id, from, to, index: index ?? this.state.columns[to].length });
  }

  work(id: CardId): boolean {
    return this.command({ type: 'work', card: id });
  }

  /** Clicks Work until the current work is closed; returns the number of clicks. */
  workUntilFinished(id: CardId): number {
    let clicks = 0;
    while (currentWorkRemaining(this.card(id)) > 0) {
      expect(this.work(id)).toBe(true);
      clicks += 1;
    }
    expect(this.work(id)).toBe(false);
    return clicks;
  }

  /** Takes a card from wherever it is to Done by hand, going through rework as often as the review returns it. */
  completeByHand(id: CardId): void {
    for (;;) {
      if (this.columnOf(id) === 'todo') expect(this.move(id, 'inProgress')).toBe(true);
      if (this.columnOf(id) === 'inProgress') {
        this.workUntilFinished(id);
        expect(this.move(id, 'review')).toBe(true);
      }
      const review = this.card(id).review;
      if (review.status === 'running') this.advance(this.rules.review.durationUs - review.elapsedUs);
      if (this.card(id).review.status === 'accepted') {
        expect(this.move(id, 'done')).toBe(true);
        return;
      }
    }
  }

  /** Plays the three scripted tasks by hand; returns at the moment the third one reaches Done. */
  completeScriptedTasks(): this {
    for (const id of this.rules.scenarioTasks.map((_, index) => index + 1)) this.completeByHand(id);
    expect(this.state.scenario.spawnerEnabled).toBe(true);
    return this;
  }

  /** Advances in steps until the predicate holds; fails if it does not within the limit. */
  advanceUntil(predicate: (state: GameState) => boolean, stepUs = 10_000, limitUs = 600_000_000): void {
    let elapsed = 0;
    while (!predicate(this.state)) {
      if (elapsed >= limitUs) throw new Error(`Condition not reached within ${limitUs} µs`);
      this.advance(stepUs);
      elapsed += stepUs;
    }
  }
}

export type CardSetup = Partial<Pick<Card, 'implementationDone' | 'reworkRequired' | 'reworkDone' | 'returnCount' | 'review'>> & {
  complexity?: number;
};

/** Builds a board directly: cards are placed in the given columns in order, with sequential numbers from 1. */
export function boardWith(
  layout: Partial<Record<ColumnId, readonly CardSetup[]>>,
  tweak?: (draft: Draft<GameState>) => void,
  rules: Rules = testRules,
): GameState {
  return produce(createInitialState(rules, 1), (draft) => {
    draft.cards = {};
    draft.columns = { todo: [], inProgress: [], review: [], done: [] };
    let number = 1;
    for (const column of ['todo', 'inProgress', 'review', 'done'] as const) {
      for (const setup of layout[column] ?? []) {
        const card: Draft<Card> = createCard(rules, number, setup.complexity ?? 10, null);
        Object.assign(card, setup);
        if (column === 'done') card.doneAtUs = 0;
        draft.cards[number] = card;
        draft.columns[column].push(number);
        number += 1;
      }
    }
    draft.nextCardNumber = number;
    draft.scenario.revealed = { codeReview: true, done: true, balance: true, shop: true };
    draft.scenario.scriptedTasksIssued = rules.scenarioTasks.length;
    draft.scenario.spawnerEnabled = true;
    draft.economy.completedTasks = Math.max(draft.columns.done.length, rules.scenarioTasks.length);
    tweak?.(draft);
    reconcileTimers(draft, rules);
  });
}
