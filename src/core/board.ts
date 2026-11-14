import type { Draft } from 'immer';
import { balance } from '../config/balance.ts';
import { applyWork, isImplementationComplete, isUnfinished } from './cards.ts';
import { payReward } from './economy.ts';
import type { EventSink, MoveActor } from './events.ts';
import { advanceScenarioAfterCompletion, reveal } from './scenario.ts';
import { columnIds, type Card, type CardId, type ColumnId, type GameState } from './state.ts';

const forwardStep: Readonly<Partial<Record<ColumnId, ColumnId>>> = {
  todo: 'inProgress',
  inProgress: 'review',
  review: 'done',
};

export const sortableColumns: readonly ColumnId[] = ['todo', 'inProgress', 'review'];

export function columnOf(state: GameState, card: CardId): ColumnId | null {
  return columnIds.find((column) => state.columns[column].includes(card)) ?? null;
}

export function requireCard(state: GameState, id: CardId): Card {
  const card = state.cards[id];
  if (!card) throw new Error(`Card ${id} is not on the board`);
  return card;
}

export function requireDraftCard(draft: Draft<GameState>, id: CardId): Draft<Card> {
  const card = draft.cards[id];
  if (!card) throw new Error(`Card ${id} is not on the board`);
  return card;
}

/** Manual moves go forward only: To Do → In Progress always, then only once the current stage is finished. */
export function canMoveCard(state: GameState, id: CardId, from: ColumnId, to: ColumnId): boolean {
  const card = state.cards[id];
  if (!card || forwardStep[from] !== to || !state.columns[from].includes(id)) return false;
  switch (to) {
    case 'inProgress':
      return true;
    case 'review':
      return state.scenario.revealed.codeReview && !isUnfinished(card);
    case 'done':
      return state.scenario.revealed.done && card.review.status === 'accepted';
    case 'todo':
      return false;
  }
}

export function canWork(state: GameState, id: CardId): boolean {
  const card = state.cards[id];
  return card !== undefined && state.columns.inProgress.includes(id) && isUnfinished(card);
}

/** Work by a click or an AI tick; the first full implementation bar reveals Code Review. */
export function workOnCard(draft: Draft<GameState>, card: Draft<Card>, amount: number, events: EventSink): void {
  applyWork(card, amount);
  if (isImplementationComplete(card)) reveal(draft, 'codeReview', events);
}

export function canReorderCard(state: GameState, id: CardId, column: ColumnId): boolean {
  return sortableColumns.includes(column) && state.columns[column].includes(id);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function removeFromColumn(draft: Draft<GameState>, column: ColumnId, id: CardId): void {
  const list = draft.columns[column];
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
}

/** `index` is the final position of the card in its column. */
export function reorderCard(draft: Draft<GameState>, id: CardId, column: ColumnId, index: number): void {
  removeFromColumn(draft, column, id);
  const list = draft.columns[column];
  list.splice(clamp(Math.trunc(index), 0, list.length), 0, id);
}

/**
 * Moves a card and applies what entering the column means. `placement` is the insertion index in the target
 * column, or `'bottom'` for automatic moves; Done always receives cards at the top, newest first.
 */
export function moveCardTo(
  draft: Draft<GameState>,
  id: CardId,
  from: ColumnId,
  to: ColumnId,
  placement: number | 'bottom',
  by: MoveActor,
  events: EventSink,
): void {
  removeFromColumn(draft, from, id);
  const target = draft.columns[to];
  if (to === 'done') target.unshift(id);
  else if (placement === 'bottom') target.push(id);
  else target.splice(clamp(Math.trunc(placement), 0, target.length), 0, id);
  events.push({ type: 'cardMoved', card: id, from, to, by });

  const card = requireDraftCard(draft, id);
  if (to === 'review') card.review = { status: 'running', elapsedUs: 0 };
  if (to === 'done') completeTask(draft, card, by, events);
}

function completeTask(draft: Draft<GameState>, card: Draft<Card>, by: MoveActor, events: EventSink): void {
  card.review = { status: 'none' };
  card.doneAtUs = draft.timeUs;
  payReward(draft, card, by, events);
  reveal(draft, 'balance', events);
  trimDone(draft, events);
  advanceScenarioAfterCompletion(draft, events);
}

/** Done keeps the newest `DoneMaxCards` cards; the oldest simply disappears without touching Credits or stats. */
function trimDone(draft: Draft<GameState>, events: EventSink): void {
  while (draft.columns.done.length > balance.done.maxCards) {
    const oldest = draft.columns.done.pop();
    if (oldest === undefined) return;
    Reflect.deleteProperty(draft.cards, oldest);
    events.push({ type: 'doneCardRemoved', card: oldest });
  }
}
