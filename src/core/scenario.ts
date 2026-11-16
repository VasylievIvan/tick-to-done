import type { Draft } from 'immer';
import type { EventSink } from './events.ts';
import type { Rules } from './rules.ts';
import { createTask } from './spawner.ts';
import type { GameState, RevealableElement } from './state.ts';

export function reveal(draft: Draft<GameState>, element: RevealableElement, events: EventSink): void {
  if (draft.scenario.revealed[element]) return;
  draft.scenario.revealed[element] = true;
  events.push({ type: 'interfaceRevealed', element });
}

/**
 * Until the regular generator is on, the only card on the board is the current scripted task, so a completion
 * always belongs to it: issue the next scripted task, or after the last one open the shop and the generator.
 */
export function advanceScenarioAfterCompletion(draft: Draft<GameState>, rules: Rules, events: EventSink): void {
  if (draft.scenario.spawnerEnabled) return;
  const nextTask = rules.scenarioTasks[draft.scenario.scriptedTasksIssued];
  if (nextTask) {
    createTask(draft, rules, nextTask.complexity, nextTask.firstReview, 'scenario', events);
    draft.scenario.scriptedTasksIssued += 1;
    return;
  }
  reveal(draft, 'shop', events);
  draft.scenario.spawnerEnabled = true;
}
