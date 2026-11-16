import { advanceTime, applyCommand, type Command } from '../core/engine.ts';
import {
  canBuyUpgrade,
  canMoveCard,
  currentUpgradeCost,
  isRepeatableUpgrade,
  isUnfinished,
  visibleUpgrades,
} from '../core/selectors.ts';
import type { OneTimeUpgradeId, Rules, UpgradeId } from '../core/rules.ts';
import { columnIds, createInitialState, timerIds, type ColumnId, type GameState, type TimerId } from '../core/state.ts';

/**
 * A simple model of a human: one action at a time, each taking attention time. Material for the open questions on
 * pacing; it does not decide or change the balance.
 */
export interface PlayerModel {
  readonly clicksPerSecond: number;
  readonly dragSeconds: number;
  readonly purchaseSeconds: number;
}

export type PurchaseStrategy = 'automationFirst' | 'keyboardFirst' | 'cheapestFirst';

export interface SimulationOptions {
  readonly rules: Rules;
  readonly seed: number;
  readonly strategy: PurchaseStrategy;
  readonly player: PlayerModel;
  readonly limitSeconds: number;
  /** How long to keep observing after all four one-time automations are bought. */
  readonly observeSecondsAfterFullAutomation: number;
}

export interface Milestone {
  readonly seconds: number;
  readonly clicks: number;
  readonly drags: number;
}

export interface SimulationResult {
  readonly seed: number;
  readonly strategy: PurchaseStrategy;
  readonly firstPurchase: (Milestone & { readonly upgrade: UpgradeId }) | null;
  readonly automations: Readonly<Partial<Record<OneTimeUpgradeId, Milestone>>>;
  readonly fullAutomation: Milestone | null;
  readonly purchaseOrder: readonly UpgradeId[];
  /** Averages over the observation window after full automation. */
  readonly afterFullAutomation: {
    readonly columnLoad: Readonly<Record<ColumnId, number>>;
    readonly timerIdleShare: Readonly<Record<TimerId, number>>;
    readonly tasksPerMinute: number;
  } | null;
}

const STEP_US = 50_000;
const oneTimeAutomations: readonly OneTimeUpgradeId[] = ['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete'];

function nextPurchase(state: GameState, rules: Rules, strategy: PurchaseStrategy): UpgradeId | null {
  const visible = visibleUpgrades(state, rules);
  const cheapest = (ids: readonly UpgradeId[]) =>
    [...ids].sort((a, b) => currentUpgradeCost(state, rules, a) - currentUpgradeCost(state, rules, b))[0] ?? null;
  const missingAutomation = oneTimeAutomations.find((id) => !state.upgrades.owned[id]);

  let wanted: UpgradeId | null;
  if (strategy === 'cheapestFirst') {
    wanted = cheapest(visible.filter((id) => canBuyUpgrade(state, rules, id)));
  } else if (strategy === 'keyboardFirst' && state.upgrades.levels.betterKeyboard < 2) {
    wanted = 'betterKeyboard';
  } else if (missingAutomation) {
    wanted = missingAutomation;
  } else {
    wanted = cheapest(visible.filter((id) => canBuyUpgrade(state, rules, id)));
  }
  return wanted !== null && canBuyUpgrade(state, rules, wanted) ? wanted : null;
}

/** Forward moves the player still makes by hand: the end of the pipeline first, as a person would clear it. */
function nextDrag(state: GameState): Command | null {
  const { owned } = state.upgrades;
  if (!owned.autoComplete) {
    const card = state.columns.review.find((id) => canMoveCard(state, id, 'review', 'done'));
    if (card !== undefined) return { type: 'moveCard', card, from: 'review', to: 'done', index: 0 };
  }
  if (!owned.autoSubmit) {
    const card = state.columns.inProgress.find((id) => canMoveCard(state, id, 'inProgress', 'review'));
    if (card !== undefined) return { type: 'moveCard', card, from: 'inProgress', to: 'review', index: 0 };
  }
  const unfinished = state.columns.inProgress.filter((id) => {
    const card = state.cards[id];
    return card !== undefined && isUnfinished(card);
  });
  const top = state.columns.todo[0];
  if (!owned.autoAssign && unfinished.length === 0 && top !== undefined) {
    return { type: 'moveCard', card: top, from: 'todo', to: 'inProgress', index: state.columns.inProgress.length };
  }
  return null;
}

function nextClick(state: GameState): Command | null {
  const card = state.columns.inProgress.find((id) => {
    const value = state.cards[id];
    return value !== undefined && isUnfinished(value);
  });
  return card === undefined ? null : { type: 'work', card };
}

const zeroColumns = (): Record<ColumnId, number> => ({ todo: 0, inProgress: 0, review: 0, done: 0 });
const zeroTimers = (): Record<TimerId, number> => ({
  aiDeveloper: 0,
  autoAssign: 0,
  autoSubmit: 0,
  autoComplete: 0,
  spawner: 0,
});

export function simulate(options: SimulationOptions): SimulationResult {
  const { player, rules } = options;
  let state = createInitialState(rules, options.seed);
  let timeUs = 0;
  let busyUntilUs = 0;
  let clicks = 0;
  let drags = 0;
  let firstPurchase: SimulationResult['firstPurchase'] = null;
  const automations: Partial<Record<OneTimeUpgradeId, Milestone>> = {};
  const purchaseOrder: UpgradeId[] = [];
  let fullAutomation: Milestone | null = null;
  let completedAtFull = 0;
  let samples = 0;
  const load = zeroColumns();
  const idle = zeroTimers();

  const limitUs = options.limitSeconds * 1_000_000;
  const observeUs = options.observeSecondsAfterFullAutomation * 1_000_000;
  const milestone = (): Milestone => ({ seconds: timeUs / 1_000_000, clicks, drags });

  while (timeUs < limitUs) {
    if (fullAutomation && timeUs >= fullAutomation.seconds * 1_000_000 + observeUs) break;

    if (timeUs >= busyUntilUs) {
      const purchase = nextPurchase(state, rules, options.strategy);
      const drag = purchase === null ? nextDrag(state) : null;
      const click = purchase === null && drag === null ? nextClick(state) : null;
      if (purchase !== null) {
        state = applyCommand(state, rules, { type: 'buyUpgrade', upgrade: purchase }).state;
        purchaseOrder.push(purchase);
        firstPurchase ??= { ...milestone(), upgrade: purchase };
        if (!isRepeatableUpgrade(purchase)) automations[purchase] = milestone();
        if (!fullAutomation && oneTimeAutomations.every((id) => state.upgrades.owned[id])) {
          fullAutomation = milestone();
          completedAtFull = state.economy.completedTasks;
        }
        busyUntilUs = timeUs + player.purchaseSeconds * 1_000_000;
      } else if (drag !== null) {
        state = applyCommand(state, rules, drag).state;
        drags += 1;
        busyUntilUs = timeUs + player.dragSeconds * 1_000_000;
      } else if (click !== null) {
        state = applyCommand(state, rules, click).state;
        clicks += 1;
        busyUntilUs = timeUs + 1_000_000 / player.clicksPerSecond;
      }
    }

    state = advanceTime(state, rules, STEP_US).state;
    timeUs += STEP_US;

    if (fullAutomation) {
      samples += 1;
      for (const column of columnIds) load[column] += state.columns[column].length;
      for (const timer of timerIds) if (!state.timers[timer].active) idle[timer] += 1;
    }
  }

  const observedMinutes = (samples * STEP_US) / 60_000_000;
  return {
    seed: options.seed,
    strategy: options.strategy,
    firstPurchase,
    automations,
    fullAutomation,
    purchaseOrder,
    afterFullAutomation:
      samples === 0
        ? null
        : {
            columnLoad: Object.fromEntries(columnIds.map((id) => [id, load[id] / samples])) as Record<ColumnId, number>,
            timerIdleShare: Object.fromEntries(timerIds.map((id) => [id, idle[id] / samples])) as Record<TimerId, number>,
            tasksPerMinute: (state.economy.completedTasks - completedAtFull) / observedMinutes,
          },
  };
}

export const purchaseStrategies: readonly PurchaseStrategy[] = ['automationFirst', 'keyboardFirst', 'cheapestFirst'];
