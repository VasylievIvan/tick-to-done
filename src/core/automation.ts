import type { Draft } from 'immer';
import { moveCardTo, requireDraftCard, workOnCard } from './board.ts';
import { isUnfinished } from './cards.ts';
import { unfinishedInProgressCount } from './counts.ts';
import { aiWorkPowerAt, parallelTasksAt } from './economy.ts';
import type { EventSink } from './events.ts';
import type { Rules } from './rules.ts';
import type { CardId, GameState } from './state.ts';

/**
 * One AI Developer tick: the topmost unfinished cards in In Progress, at most ParallelTasks of them, each get the
 * full AIWorkPower. Power beyond a card's remaining work is lost, never passed to another card.
 */
export function aiTick(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  const power = aiWorkPowerAt(rules, draft.upgrades.levels.aiWorkPower);
  const slots = parallelTasksAt(rules, draft.upgrades.levels.parallelProcessing);
  const selected = draft.columns.inProgress
    .filter((id) => {
      const card = draft.cards[id];
      return card !== undefined && isUnfinished(card);
    })
    .slice(0, slots);
  for (const id of selected) workOnCard(draft, requireDraftCard(draft, id), power, events);
}

/** The topmost unfinished cards fill the AI slots; the top To Do card needs one of them to be free. */
export function canAutoAssign(state: GameState, rules: Rules): boolean {
  return (
    state.upgrades.owned.autoAssign &&
    state.columns.todo.length > 0 &&
    unfinishedInProgressCount(state) < parallelTasksAt(rules, state.upgrades.levels.parallelProcessing)
  );
}

export function topFinishedInProgress(state: GameState): CardId | undefined {
  return state.columns.inProgress.find((id) => {
    const card = state.cards[id];
    return card !== undefined && !isUnfinished(card);
  });
}

export function topAcceptedInReview(state: GameState): CardId | undefined {
  return state.columns.review.find((id) => state.cards[id]?.review.status === 'accepted');
}

export function canAutoSubmit(state: GameState): boolean {
  return state.upgrades.owned.autoSubmit && topFinishedInProgress(state) !== undefined;
}

export function canAutoComplete(state: GameState): boolean {
  return state.upgrades.owned.autoComplete && topAcceptedInReview(state) !== undefined;
}

/** Each automation moves at most one card per firing, always to the bottom of the next column. */
export function autoAssign(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  const top = draft.columns.todo[0];
  if (top !== undefined) moveCardTo(draft, rules, top, 'todo', 'inProgress', 'bottom', 'autoAssign', events);
}

export function autoSubmit(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  const top = topFinishedInProgress(draft);
  if (top !== undefined) moveCardTo(draft, rules, top, 'inProgress', 'review', 'bottom', 'autoSubmit', events);
}

export function autoComplete(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  const top = topAcceptedInReview(draft);
  if (top !== undefined) moveCardTo(draft, rules, top, 'review', 'done', 'bottom', 'autoComplete', events);
}
