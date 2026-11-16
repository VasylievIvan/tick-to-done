import type { Draft } from 'immer';
import { activeTasksCount } from './counts.ts';
import type { CardSource, EventSink } from './events.ts';
import { drawUint32, uniformIntInclusive } from './rng.ts';
import type { Rules, ScriptedReviewOutcome } from './rules.ts';
import { createCard, type CardId, type GameState } from './state.ts';

/** Every automatic appearance goes to the bottom of To Do. */
export function createTask(
  draft: Draft<GameState>,
  rules: Rules,
  complexity: number,
  scriptedReview: ScriptedReviewOutcome | null,
  source: CardSource,
  events: EventSink,
): CardId {
  const number = draft.nextCardNumber;
  draft.nextCardNumber += 1;
  draft.cards[number] = createCard(rules, number, complexity, scriptedReview);
  draft.columns.todo.push(number);
  events.push({ type: 'cardCreated', card: number, source });
  return number;
}

/** Generator limits are checked only here: returns from Review bypass them. */
export function canSpawnRegularTask(state: GameState, rules: Rules): boolean {
  return (
    state.scenario.spawnerEnabled &&
    state.columns.todo.length < rules.spawner.toDoLimit &&
    activeTasksCount(state) < rules.spawner.boardLimit
  );
}

export function spawnRegularTask(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  const { min, max } = rules.regularTaskComplexity;
  const complexity = uniformIntInclusive(drawUint32(draft.rng, 'generation'), min, max);
  createTask(draft, rules, complexity, null, 'spawner', events);
}
