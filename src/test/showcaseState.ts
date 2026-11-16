import { produce } from 'immer';
import { upgradeIds } from '../core/rules.ts';
import { createCard, createInitialState, type Card, type GameState } from '../core/state.ts';
import { testRules } from './testRules.ts';

/** A board with every card state and every revealed element, for screen-wide rendering tests. */
export function showcaseState(): GameState {
  return produce(createInitialState(testRules, 1), (draft) => {
    const cards: [Card['number'], Partial<Card>, 'todo' | 'inProgress' | 'review' | 'done'][] = [
      [10, {}, 'todo'],
      [11, { implementationDone: 20, reworkRequired: 6, reworkDone: 0, returnCount: 1 }, 'todo'],
      [12, { implementationDone: 3 }, 'inProgress'],
      [13, { implementationDone: 20 }, 'inProgress'],
      [14, { implementationDone: 20, reworkRequired: 10, reworkDone: 6, returnCount: 2 }, 'inProgress'],
      [15, { implementationDone: 20, review: { status: 'running', elapsedUs: 700_000 } }, 'review'],
      [16, { implementationDone: 20, review: { status: 'accepted' } }, 'review'],
      [17, { implementationDone: 20, doneAtUs: 0 }, 'done'],
    ];
    draft.cards = {};
    draft.columns = { todo: [], inProgress: [], review: [], done: [] };
    for (const [number, overrides, column] of cards) {
      draft.cards[number] = { ...createCard(testRules, number, 20, null), ...overrides };
      draft.columns[column].push(number);
    }
    draft.nextCardNumber = 18;
    draft.economy = { credits: 1234, completedTasks: 17, returnedReviews: 3, totalEarned: 1500 };
    for (const id of upgradeIds) draft.upgrades.discovered[id] = true;
    draft.upgrades.owned = { aiDeveloper: true, autoAssign: true, autoSubmit: true, autoComplete: true };
    draft.upgrades.levels.betterKeyboard = 2;
    draft.upgrades.levels.aiTickSpeed = 7;
    draft.scenario = {
      scriptedTasksIssued: testRules.scenarioTasks.length,
      revealed: { codeReview: true, done: true, balance: true, shop: true },
      spawnerEnabled: true,
    };
  });
}
