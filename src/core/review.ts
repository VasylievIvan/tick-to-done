import type { Draft } from 'immer';
import { balance, type ScriptedReviewOutcome } from '../config/balance.ts';
import { removeFromColumn, requireDraftCard } from './board.ts';
import type { EventSink } from './events.ts';
import { ceilScaledByUniformFactor, drawUint32, isBelowProbability } from './rng.ts';
import { reveal } from './scenario.ts';
import type { Card, CardId, GameState } from './state.ts';

/** Scripted outcomes consume no randomness; afterwards every review uses the base return probability. */
function takeOutcome(draft: Draft<GameState>, card: Draft<Card>): ScriptedReviewOutcome {
  const scripted = card.scriptedReview;
  if (scripted !== null) {
    card.scriptedReview = null;
    return scripted;
  }
  const draw = drawUint32(draft.rng, 'review');
  return isBelowProbability(draw, balance.review.returnProbability) ? 'return' : 'pass';
}

export function resolveReview(draft: Draft<GameState>, id: CardId, events: EventSink): void {
  const card = requireDraftCard(draft, id);
  if (takeOutcome(draft, card) === 'pass') {
    card.review = { status: 'accepted' };
    events.push({ type: 'reviewPassed', card: id });
    reveal(draft, 'done', events);
    return;
  }

  const rework = ceilScaledByUniformFactor(
    drawUint32(draft.rng, 'rework'),
    card.originalComplexity,
    balance.review.reworkFactor,
  );
  card.reworkRequired += rework;
  card.returnCount += 1;
  card.review = { status: 'none' };
  draft.economy.returnedReviews += 1;
  removeFromColumn(draft, 'review', id);
  draft.columns.todo.push(id);
  events.push({ type: 'reviewReturned', card: id, rework });
}
