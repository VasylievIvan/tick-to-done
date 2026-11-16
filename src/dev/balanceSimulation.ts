import { advanceTime, applyCommand, type Command } from '../core/engine.ts';
import {
  canBuyUpgrade,
  canMoveCard,
  currentUpgradeCost,
  isRepeatableUpgrade,
  isUnfinished,
  visibleUpgrades,
} from '../core/selectors.ts';
import {
  repeatableUpgradeIds,
  type OneTimeUpgradeId,
  type RepeatableUpgradeId,
  type Rules,
  type UpgradeId,
} from '../core/rules.ts';
import { columnIds, createInitialState, timerIds, type ColumnId, type GameState, type TimerId } from '../core/state.ts';

/**
 * A simple model of a human: one action at a time, each taking attention time. Material for the playtest questions
 * on pacing; it does not decide or change the balance.
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
  /** Length of the window right after all four one-time automations are bought. */
  readonly observeSecondsAfterFullAutomation: number;
  readonly segmentSeconds: number;
  /** Length of the closing window over which timer idle shares are measured. */
  readonly finalWindowSeconds: number;
}

export interface Milestone {
  readonly seconds: number;
  readonly clicks: number;
  readonly drags: number;
}

export interface Segment {
  readonly creditsPerMinute: number;
  readonly tasksPerMinute: number;
  readonly purchases: number;
}

/** Idle share of a timer whose upgrade was owned for the whole window; `null` when it was not. */
export type IdleShares = Readonly<Record<TimerId, number | null>>;

export interface SimulationResult {
  readonly seed: number;
  readonly strategy: PurchaseStrategy;
  readonly firstPurchase: (Milestone & { readonly upgrade: UpgradeId }) | null;
  readonly automations: Readonly<Partial<Record<OneTimeUpgradeId, Milestone>>>;
  readonly fullAutomation: Milestone | null;
  readonly purchaseOrder: readonly UpgradeId[];
  /** Averages over the window right after full automation. */
  readonly afterFullAutomation: {
    readonly columnLoad: Readonly<Record<ColumnId, number>>;
    readonly timerIdleShare: IdleShares;
    readonly tasksPerMinute: number;
  } | null;
  readonly segments: readonly Segment[];
  readonly finalLevels: Readonly<Record<RepeatableUpgradeId, number>>;
  readonly finalIdleShare: IdleShares;
  readonly finalCredits: number;
  readonly totalEarned: number;
}

const STEP_US = 50_000;
const US_PER_SECOND = 1_000_000;
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

const timerOwner: Readonly<Record<TimerId, OneTimeUpgradeId | null>> = {
  aiDeveloper: 'aiDeveloper',
  autoAssign: 'autoAssign',
  autoSubmit: 'autoSubmit',
  autoComplete: 'autoComplete',
  spawner: null,
};

/** Counts samples where a timer is idle, only while its upgrade is owned; a timer owned late is reported as `null`. */
class IdleCounter {
  private samples = 0;
  private readonly idle: Record<TimerId, number> = { aiDeveloper: 0, autoAssign: 0, autoSubmit: 0, autoComplete: 0, spawner: 0 };
  private readonly ownedThroughout: Record<TimerId, boolean> = {
    aiDeveloper: true,
    autoAssign: true,
    autoSubmit: true,
    autoComplete: true,
    spawner: true,
  };

  sample(state: GameState): void {
    this.samples += 1;
    for (const timer of timerIds) {
      const owner = timerOwner[timer];
      if (owner !== null && !state.upgrades.owned[owner]) this.ownedThroughout[timer] = false;
      if (!state.timers[timer].active) this.idle[timer] += 1;
    }
  }

  shares(): IdleShares {
    const entries = timerIds.map((timer) => [
      timer,
      this.samples > 0 && this.ownedThroughout[timer] ? this.idle[timer] / this.samples : null,
    ]);
    return Object.fromEntries(entries) as Record<TimerId, number | null>;
  }
}

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
  let completedAtWindowEnd = 0;
  let observedSamples = 0;
  const load: Record<ColumnId, number> = { todo: 0, inProgress: 0, review: 0, done: 0 };
  const idleAfterFull = new IdleCounter();
  const idleAtEnd = new IdleCounter();

  const limitUs = options.limitSeconds * US_PER_SECOND;
  const observeUs = options.observeSecondsAfterFullAutomation * US_PER_SECOND;
  const segmentUs = options.segmentSeconds * US_PER_SECOND;
  if (!Number.isInteger(segmentUs / STEP_US)) throw new RangeError(`A segment must be a whole number of ${STEP_US} µs steps`);
  const finalWindowStartUs = limitUs - options.finalWindowSeconds * US_PER_SECOND;
  const segments: Segment[] = [];
  let segmentStart = { earned: 0, completed: 0, purchases: 0 };
  const milestone = (): Milestone => ({ seconds: timeUs / US_PER_SECOND, clicks, drags });

  while (timeUs < limitUs) {
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
        busyUntilUs = timeUs + player.purchaseSeconds * US_PER_SECOND;
      } else if (drag !== null) {
        state = applyCommand(state, rules, drag).state;
        drags += 1;
        busyUntilUs = timeUs + player.dragSeconds * US_PER_SECOND;
      } else if (click !== null) {
        state = applyCommand(state, rules, click).state;
        clicks += 1;
        busyUntilUs = timeUs + US_PER_SECOND / player.clicksPerSecond;
      }
    }

    state = advanceTime(state, rules, STEP_US).state;
    timeUs += STEP_US;

    if (fullAutomation && timeUs <= fullAutomation.seconds * US_PER_SECOND + observeUs) {
      observedSamples += 1;
      for (const column of columnIds) load[column] += state.columns[column].length;
      idleAfterFull.sample(state);
      completedAtWindowEnd = state.economy.completedTasks;
    }
    if (timeUs > finalWindowStartUs) idleAtEnd.sample(state);
    if (timeUs % segmentUs === 0) {
      const minutes = segmentUs / (60 * US_PER_SECOND);
      segments.push({
        creditsPerMinute: (state.economy.totalEarned - segmentStart.earned) / minutes,
        tasksPerMinute: (state.economy.completedTasks - segmentStart.completed) / minutes,
        purchases: purchaseOrder.length - segmentStart.purchases,
      });
      segmentStart = {
        earned: state.economy.totalEarned,
        completed: state.economy.completedTasks,
        purchases: purchaseOrder.length,
      };
    }
  }

  const observedMinutes = (observedSamples * STEP_US) / (60 * US_PER_SECOND);
  return {
    seed: options.seed,
    strategy: options.strategy,
    firstPurchase,
    automations,
    fullAutomation,
    purchaseOrder,
    afterFullAutomation:
      observedSamples === 0
        ? null
        : {
            columnLoad: Object.fromEntries(columnIds.map((id) => [id, load[id] / observedSamples])) as Record<ColumnId, number>,
            timerIdleShare: idleAfterFull.shares(),
            tasksPerMinute: (completedAtWindowEnd - completedAtFull) / observedMinutes,
          },
    segments,
    finalLevels: Object.fromEntries(repeatableUpgradeIds.map((id) => [id, state.upgrades.levels[id]])) as Record<
      RepeatableUpgradeId,
      number
    >,
    finalIdleShare: idleAtEnd.shares(),
    finalCredits: state.economy.credits,
    totalEarned: state.economy.totalEarned,
  };
}

export const purchaseStrategies: readonly PurchaseStrategy[] = ['automationFirst', 'keyboardFirst', 'cheapestFirst'];
