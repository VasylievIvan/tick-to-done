import { isDiscoveryThresholdReached } from './economy.ts';
import { createRngState, type RngState } from './rng.ts';
import {
  type OneTimeUpgradeId,
  type RepeatableUpgradeId,
  type Rules,
  type ScriptedReviewOutcome,
  type TaskTitleKey,
  type UpgradeId,
  upgradeIds,
} from './rules.ts';

export const columnIds = ['todo', 'inProgress', 'review', 'done'] as const;
export type ColumnId = (typeof columnIds)[number];

/** The task number: unique, sequential, assigned at creation and kept across returns. */
export type CardId = number;

export type ReviewState =
  | { readonly status: 'none' }
  | { readonly status: 'running'; readonly elapsedUs: number }
  | { readonly status: 'accepted' };

export interface Card {
  readonly number: CardId;
  readonly titleKey: TaskTitleKey;
  readonly originalComplexity: number;
  readonly implementationDone: number;
  /** Cumulative over all returns: each return adds its own amount, completed rework is never reset. */
  readonly reworkRequired: number;
  readonly reworkDone: number;
  readonly returnCount: number;
  readonly review: ReviewState;
  /** Scripted result of the next review; consumed by it, after which the base return probability applies. */
  readonly scriptedReview: ScriptedReviewOutcome | null;
  readonly doneAtUs: number | null;
}

export const timerIds = ['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete', 'spawner'] as const;
export type TimerId = (typeof timerIds)[number];

export interface TimerState {
  readonly active: boolean;
  readonly elapsedUs: number;
}

export const revealableElements = ['codeReview', 'done', 'balance', 'shop'] as const;
export type RevealableElement = (typeof revealableElements)[number];

export interface EconomyState {
  readonly credits: number;
  readonly completedTasks: number;
  readonly returnedReviews: number;
  readonly totalEarned: number;
}

export interface UpgradesState {
  readonly levels: Readonly<Record<RepeatableUpgradeId, number>>;
  readonly owned: Readonly<Record<OneTimeUpgradeId, boolean>>;
  /** Discovery thresholds ever reached; never cleared by spending. */
  readonly discovered: Readonly<Record<UpgradeId, boolean>>;
}

export interface ScenarioState {
  readonly scriptedTasksIssued: number;
  readonly revealed: Readonly<Record<RevealableElement, boolean>>;
  readonly spawnerEnabled: boolean;
}

export interface GameState {
  readonly timeUs: number;
  readonly rng: RngState;
  readonly cards: Readonly<Record<CardId, Card>>;
  /** Order is game data: "the topmost eligible card" is chosen by position. */
  readonly columns: Readonly<Record<ColumnId, readonly CardId[]>>;
  readonly nextCardNumber: number;
  readonly economy: EconomyState;
  readonly upgrades: UpgradesState;
  readonly timers: Readonly<Record<TimerId, TimerState>>;
  readonly scenario: ScenarioState;
}

export function createCard(
  rules: Rules,
  number: CardId,
  originalComplexity: number,
  scriptedReview: ScriptedReviewOutcome | null,
): Card {
  return {
    number,
    titleKey: rules.taskTitleKey,
    originalComplexity,
    implementationDone: 0,
    reworkRequired: 0,
    reworkDone: 0,
    returnCount: 0,
    review: { status: 'none' },
    scriptedReview,
    doneAtUs: null,
  };
}

const idleTimer: TimerState = { active: false, elapsedUs: 0 };

function discoveryAt(rules: Rules, credits: number): Record<UpgradeId, boolean> {
  const entries = upgradeIds.map((id) => [id, isDiscoveryThresholdReached(rules, credits, rules.upgrades[id].baseCost)]);
  return Object.fromEntries(entries) as Record<UpgradeId, boolean>;
}

export function createInitialState(rules: Rules, seed: number): GameState {
  const [firstTask] = rules.scenarioTasks;
  const firstCard = createCard(rules, 1, firstTask.complexity, firstTask.firstReview);

  return {
    timeUs: 0,
    rng: createRngState(seed),
    cards: { [firstCard.number]: firstCard },
    columns: { todo: [firstCard.number], inProgress: [], review: [], done: [] },
    nextCardNumber: firstCard.number + 1,
    economy: { credits: rules.initialCredits, completedTasks: 0, returnedReviews: 0, totalEarned: 0 },
    upgrades: {
      levels: { betterKeyboard: 0, aiWorkPower: 0, aiTickSpeed: 0, parallelProcessing: 0, fasterBacklog: 0, biggerTasks: 0 },
      owned: { aiDeveloper: false, autoAssign: false, autoSubmit: false, autoComplete: false },
      discovered: discoveryAt(rules, rules.initialCredits),
    },
    timers: {
      aiDeveloper: idleTimer,
      autoAssign: idleTimer,
      autoSubmit: idleTimer,
      autoComplete: idleTimer,
      spawner: idleTimer,
    },
    scenario: {
      scriptedTasksIssued: 1,
      revealed: { codeReview: false, done: false, balance: false, shop: false },
      spawnerEnabled: false,
    },
  };
}
