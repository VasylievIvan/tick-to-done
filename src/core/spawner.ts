import type { Draft } from 'immer';
import type { ScriptedReviewOutcome } from '../config/balance.ts';
import type { CardSource, EventSink } from './events.ts';
import { createCard, type CardId, type GameState } from './state.ts';

/** Every automatic appearance goes to the bottom of To Do. */
export function createTask(
  draft: Draft<GameState>,
  complexity: number,
  scriptedReview: ScriptedReviewOutcome | null,
  source: CardSource,
  events: EventSink,
): CardId {
  const number = draft.nextCardNumber;
  draft.nextCardNumber += 1;
  draft.cards[number] = createCard(number, complexity, scriptedReview);
  draft.columns.todo.push(number);
  events.push({ type: 'cardCreated', card: number, source });
  return number;
}
