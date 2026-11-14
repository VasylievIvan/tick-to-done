import type { Draft } from 'immer';
import { balance, type ScriptedReviewOutcome } from '../config/balance.ts';
import { activeTasksCount } from './counts.ts';
import type { CardSource, EventSink } from './events.ts';
import { drawUint32, uniformIntInclusive } from './rng.ts';
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

/** Generator limits are checked only here: returns from Review bypass them. */
export function canSpawnRegularTask(state: GameState): boolean {
  return (
    state.scenario.spawnerEnabled &&
    state.columns.todo.length < balance.spawner.toDoLimit &&
    activeTasksCount(state) < balance.spawner.boardLimit
  );
}

export function spawnRegularTask(draft: Draft<GameState>, events: EventSink): void {
  const { min, max } = balance.regularTaskComplexity;
  const complexity = uniformIntInclusive(drawUint32(draft.rng, 'generation'), min, max);
  createTask(draft, complexity, null, 'spawner', events);
}
