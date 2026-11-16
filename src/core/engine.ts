import { produce, type Draft } from 'immer';
import {
  canMoveCard,
  canReorderCard,
  canWork,
  moveCardTo,
  reorderCard,
  requireDraftCard,
  workOnCard,
} from './board.ts';
import { aiTick, autoAssign, autoComplete, autoSubmit } from './automation.ts';
import { canBuyUpgrade, purchaseUpgrade } from './economy.ts';
import type { GameEvent } from './events.ts';
import { resolveReview } from './review.ts';
import type { Rules, UpgradeId } from './rules.ts';
import { clickPower } from './selectors.ts';
import { spawnRegularTask } from './spawner.ts';
import { timerIds, type CardId, type ColumnId, type GameState, type TimerId } from './state.ts';
import { preserveTimerShare, reconcileTimers, timerIntervalUs } from './timers.ts';

export type Command =
  | {
      readonly type: 'moveCard';
      readonly card: CardId;
      readonly from: ColumnId;
      readonly to: ColumnId;
      /** Insertion index in the target column, where the card was dropped. */
      readonly index: number;
    }
  | { readonly type: 'reorderCard'; readonly card: CardId; readonly column: ColumnId; readonly index: number }
  | { readonly type: 'work'; readonly card: CardId }
  | { readonly type: 'buyUpgrade'; readonly upgrade: UpgradeId };

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface CommandResult extends StepResult {
  readonly accepted: boolean;
}

/** The same rule the interface asks before offering an action, so a highlight and its outcome never disagree. */
export function isCommandAllowed(state: GameState, rules: Rules, command: Command): boolean {
  switch (command.type) {
    case 'moveCard':
      return canMoveCard(state, command.card, command.from, command.to);
    case 'reorderCard':
      return canReorderCard(state, command.card, command.column);
    case 'work':
      return canWork(state, command.card);
    case 'buyUpgrade':
      return canBuyUpgrade(state, rules, command.upgrade);
  }
}

function execute(draft: Draft<GameState>, rules: Rules, command: Command, events: GameEvent[]): void {
  switch (command.type) {
    case 'moveCard':
      moveCardTo(draft, rules, command.card, command.from, command.to, command.index, 'player', events);
      return;
    case 'reorderCard':
      reorderCard(draft, command.card, command.column, command.index);
      return;
    case 'work':
      workOnCard(draft, requireDraftCard(draft, command.card), clickPower(draft, rules), events);
      return;
    case 'buyUpgrade': {
      const aiIntervalBeforeUs = timerIntervalUs(draft, rules, 'aiDeveloper');
      purchaseUpgrade(draft, rules, command.upgrade, events);
      preserveTimerShare(draft, rules, 'aiDeveloper', aiIntervalBeforeUs);
      return;
    }
  }
}

/** An invalid command is rejected without changing the state and without throwing. */
export function applyCommand(state: GameState, rules: Rules, command: Command): CommandResult {
  if (!isCommandAllowed(state, rules, command)) return { state, events: [], accepted: false };
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    execute(draft, rules, command, events);
    reconcileTimers(draft, rules);
  });
  return { state: next, events, accepted: true };
}

function timeToNextFiring(state: GameState, rules: Rules): number {
  let next = Number.POSITIVE_INFINITY;
  for (const id of state.columns.review) {
    const review = state.cards[id]?.review;
    if (review?.status === 'running') next = Math.min(next, rules.review.durationUs - review.elapsedUs);
  }
  for (const id of timerIds) {
    const timer = state.timers[id];
    if (timer.active) next = Math.min(next, timerIntervalUs(state, rules, id) - timer.elapsedUs);
  }
  return next;
}

function elapse(draft: Draft<GameState>, deltaUs: number): void {
  draft.timeUs += deltaUs;
  for (const id of draft.columns.review) {
    const card = draft.cards[id];
    if (card?.review.status === 'running') card.review.elapsedUs += deltaUs;
  }
  for (const id of timerIds) {
    const timer = draft.timers[id];
    if (timer.active) timer.elapsedUs += deltaUs;
  }
}

function findDueReview(state: GameState, rules: Rules): CardId | undefined {
  return state.columns.review.find((id) => {
    const review = state.cards[id]?.review;
    return review?.status === 'running' && review.elapsedUs >= rules.review.durationUs;
  });
}

const timerFiringOrder: readonly TimerId[] = ['autoComplete', 'autoSubmit', 'aiDeveloper', 'autoAssign', 'spawner'];

function findDueTimer(state: GameState, rules: Rules): TimerId | undefined {
  return timerFiringOrder.find((id) => {
    const timer = state.timers[id];
    return timer.active && timer.elapsedUs >= timerIntervalUs(state, rules, id);
  });
}

function fireTimer(draft: Draft<GameState>, rules: Rules, timer: TimerId, events: GameEvent[]): void {
  draft.timers[timer].elapsedUs = 0;
  switch (timer) {
    case 'spawner':
      spawnRegularTask(draft, rules, events);
      return;
    case 'aiDeveloper':
      aiTick(draft, rules, events);
      return;
    case 'autoAssign':
      autoAssign(draft, rules, events);
      return;
    case 'autoSubmit':
      autoSubmit(draft, rules, events);
      return;
    case 'autoComplete':
      autoComplete(draft, rules, events);
      return;
  }
}

/**
 * Firings due at the same instant run from the end of the pipeline to its start: Review results top to bottom,
 * then Auto Complete, Auto Submit, the AI tick, Auto Assign and the generator. Every firing is followed by the
 * timer rule, so a firing can start or stop the timers after it.
 */
function fireDue(draft: Draft<GameState>, rules: Rules, events: GameEvent[]): void {
  for (;;) {
    const review = findDueReview(draft, rules);
    if (review !== undefined) {
      resolveReview(draft, rules, review, events);
    } else {
      const timer = findDueTimer(draft, rules);
      if (timer === undefined) return;
      fireTimer(draft, rules, timer, events);
    }
    reconcileTimers(draft, rules);
  }
}

/**
 * Advances from firing to firing rather than by fixed steps, so the result does not depend on how the time is
 * sliced into frames.
 */
export function advanceTime(state: GameState, rules: Rules, deltaUs: number): StepResult {
  if (!Number.isSafeInteger(deltaUs) || deltaUs < 0) {
    throw new RangeError(`Time can only advance by a whole non-negative number of microseconds, got ${deltaUs}`);
  }
  if (deltaUs === 0) return { state, events: [] };

  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    let remainingUs = deltaUs;
    for (;;) {
      const untilNextUs = timeToNextFiring(draft, rules);
      if (untilNextUs > remainingUs) {
        elapse(draft, remainingUs);
        return;
      }
      elapse(draft, untilNextUs);
      remainingUs -= untilNextUs;
      fireDue(draft, rules, events);
    }
  });
  return { state: next, events };
}
