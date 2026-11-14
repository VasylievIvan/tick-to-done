import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../core/engine.ts';
import { createCard, createInitialState, type GameState } from '../../core/state.ts';
import { boardWith } from '../../core/testing.ts';
import { dropCommand, insertionIndex, isDropAllowed } from './dnd.ts';

function board(): GameState {
  return produce(createInitialState(1), (draft) => {
    for (const number of [2, 3, 4]) draft.cards[number] = createCard(number, 10, null);
    draft.columns.todo = [1, 2];
    draft.columns.inProgress = [3, 4];
    draft.nextCardNumber = 5;
  });
}

describe('drop adapter', () => {
  it('drops above or below the card under the pointer in another column', () => {
    const state = board();
    const origin = { card: 1, column: 'todo' } as const;
    expect(dropCommand(state, origin, { kind: 'card', card: 4, placeBelow: false })).toEqual({
      type: 'moveCard', card: 1, from: 'todo', to: 'inProgress', index: 1,
    });
    expect(dropCommand(state, origin, { kind: 'card', card: 4, placeBelow: true })).toMatchObject({ index: 2 });
    expect(dropCommand(state, origin, { kind: 'column', column: 'inProgress' })).toMatchObject({ index: 2 });
  });

  it('reorders within the column to the position of the card under the pointer', () => {
    const state = board();
    const origin = { card: 1, column: 'todo' } as const;
    expect(dropCommand(state, origin, { kind: 'card', card: 2, placeBelow: true })).toEqual({
      type: 'reorderCard', card: 1, column: 'todo', index: 1,
    });
    expect(dropCommand(state, origin, { kind: 'card', card: 1, placeBelow: false })).toBeNull();
    expect(dropCommand(state, origin, { kind: 'column', column: 'todo' })).toMatchObject({ index: 1 });
  });

  it('asks the core which columns accept the card', () => {
    const state = board();
    const origin = { card: 3, column: 'inProgress' } as const;
    expect(isDropAllowed(state, origin, 'inProgress')).toBe(true);
    expect(isDropAllowed(state, origin, 'todo')).toBe(false);
    expect(isDropAllowed(state, origin, 'review')).toBe(false);
    expect(insertionIndex(state, { card: 1, column: 'todo' }, { kind: 'card', card: 3, placeBelow: false })).toBe(0);
    expect(insertionIndex(state, origin, { kind: 'column', column: 'todo' })).toBeNull();
  });

  it('marks the top of Done as the landing place, wherever the card is dropped there', () => {
    const state = boardWith({
      review: [{ implementationDone: 10, review: { status: 'accepted' } }],
      done: [{ implementationDone: 10 }, { implementationDone: 10 }],
    });
    const origin = { card: 1, column: 'review' } as const;
    expect(insertionIndex(state, origin, { kind: 'column', column: 'done' })).toBe(0);
    expect(insertionIndex(state, origin, { kind: 'card', card: 3, placeBelow: true })).toBe(0);
  });

  it('lets the core cancel a drop when the card left its origin during the gesture', () => {
    const state = board();
    const moved = applyCommand(state, { type: 'moveCard', card: 1, from: 'todo', to: 'inProgress', index: 0 }).state;
    const command = dropCommand(moved, { card: 1, column: 'todo' }, { kind: 'card', card: 2, placeBelow: true });
    expect(command).not.toBeNull();
    if (command) expect(applyCommand(moved, command).accepted).toBe(false);
  });
});
