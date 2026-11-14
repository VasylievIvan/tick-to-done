import { isUnfinished } from './cards.ts';
import type { GameState } from './state.ts';

/** Done does not count; finished work waiting for Review and accepted cards waiting for Done do. */
export function activeTasksCount(state: GameState): number {
  return state.columns.todo.length + state.columns.inProgress.length + state.columns.review.length;
}

export function unfinishedInProgressCount(state: GameState): number {
  return state.columns.inProgress.filter((id) => {
    const card = state.cards[id];
    return card !== undefined && isUnfinished(card);
  }).length;
}
