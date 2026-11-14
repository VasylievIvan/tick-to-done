import type { Draft } from 'immer';
import { requireDraftCard, workOnCard } from './board.ts';
import { isUnfinished } from './cards.ts';
import { aiWorkPowerAt, parallelTasksAt } from './economy.ts';
import type { EventSink } from './events.ts';
import type { GameState } from './state.ts';

/**
 * One AI Developer tick: the topmost unfinished cards in In Progress, at most ParallelTasks of them, each get the
 * full AIWorkPower. Power beyond a card's remaining work is lost, never passed to another card.
 */
export function aiTick(draft: Draft<GameState>, events: EventSink): void {
  const power = aiWorkPowerAt(draft.upgrades.levels.aiWorkPower);
  const slots = parallelTasksAt(draft.upgrades.levels.parallelProcessing);
  const selected = draft.columns.inProgress
    .filter((id) => {
      const card = draft.cards[id];
      return card !== undefined && isUnfinished(card);
    })
    .slice(0, slots);
  for (const id of selected) workOnCard(draft, requireDraftCard(draft, id), power, events);
}
