import { expect } from 'vitest';
import { columnOf } from './board.ts';
import { applyCommand, advanceTime, type Command, type StepResult } from './engine.ts';
import type { GameEvent } from './events.ts';
import { findInvariantViolations, findTransitionViolations } from './invariants.ts';
import { currentWorkRemaining } from './cards.ts';
import { createInitialState, type Card, type CardId, type ColumnId, type GameState } from './state.ts';

/** Test driver over the public engine: checks every invariant after every step and keeps the event history. */
export class TestSession {
  state: GameState;
  readonly events: GameEvent[] = [];
  workClicks = 0;

  constructor(seedOrState: number | GameState = 1) {
    this.state = typeof seedOrState === 'number' ? createInitialState(seedOrState) : seedOrState;
    expect(findInvariantViolations(this.state)).toEqual([]);
  }

  private record(result: StepResult): readonly GameEvent[] {
    expect(findTransitionViolations(this.state, result.state, result.events)).toEqual([]);
    expect(findInvariantViolations(result.state)).toEqual([]);
    this.state = result.state;
    this.events.push(...result.events);
    return result.events;
  }

  command(command: Command): boolean {
    const result = applyCommand(this.state, command);
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
    return this.record(advanceTime(this.state, deltaUs));
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
