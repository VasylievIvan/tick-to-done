import type { Draft } from 'immer';
import type { Card } from './state.ts';

export function implementationRemaining(card: Card): number {
  return card.originalComplexity - card.implementationDone;
}

export function reworkRemaining(card: Card): number {
  return card.reworkRequired - card.reworkDone;
}

/** Current work is the open rework if there is any, otherwise the implementation. */
export function currentWorkRemaining(card: Card): number {
  const implementation = implementationRemaining(card);
  return implementation > 0 ? implementation : reworkRemaining(card);
}

export function isUnfinished(card: Card): boolean {
  return currentWorkRemaining(card) > 0;
}

export function isImplementationComplete(card: Card): boolean {
  return implementationRemaining(card) === 0;
}

/** Applies up to `amount` units to the current work; whatever exceeds the remainder is lost. */
export function applyWork(card: Draft<Card>, amount: number): number {
  const applied = Math.min(amount, currentWorkRemaining(card));
  if (implementationRemaining(card) > 0) card.implementationDone += applied;
  else card.reworkDone += applied;
  return applied;
}
