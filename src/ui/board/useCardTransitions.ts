import { useEffect, useState } from 'react';
import type { Card, CardId, ColumnId } from '../../core/state.ts';
import { useGameStore } from '../GameContext.tsx';

export const LEAVING_CARD_MS = 1000;
export const ARRIVING_CARD_MS = 400;

export interface CardTransitions {
  /** Last copies of cards the core has already removed from the board, shown while they fade out. */
  readonly leaving: readonly Card[];
  /** Cards that have just entered the column and are still playing their arrival. */
  readonly arriving: ReadonlySet<CardId>;
}

const noArrivals: ReadonlySet<CardId> = new Set();

/**
 * The core moves and removes cards instantly; the interface animates around it. A new game is not a move: its
 * board appears and the old one disappears without any animation.
 */
export function useCardTransitions(column: ColumnId, animateArrivals: boolean): CardTransitions {
  const store = useGameStore();
  const [leaving, setLeaving] = useState<readonly Card[]>([]);
  const [arriving, setArriving] = useState<ReadonlySet<CardId>>(noArrivals);

  useEffect(() => {
    let previous = store.getState();
    const timers = new Set<number>();
    const later = (ms: number, action: () => void) => {
      const handle = window.setTimeout(() => {
        timers.delete(handle);
        action();
      }, ms);
      timers.add(handle);
    };

    const unsubscribe = store.subscribe((state) => {
      const before = previous;
      previous = state;
      if (state.generation !== before.generation) {
        setLeaving([]);
        setArriving(noArrivals);
        return;
      }
      const was = before.game.columns[column];
      const now = state.game.columns[column];
      if (now === was) return;

      const gone = was.flatMap((id) => {
        const card = before.game.cards[id];
        return card && !(id in state.game.cards) ? [card] : [];
      });
      if (gone.length > 0) {
        setLeaving((current) => [...current, ...gone]);
        later(LEAVING_CARD_MS, () => {
          setLeaving((current) => current.filter((card) => !gone.includes(card)));
        });
      }

      const entered = animateArrivals ? now.filter((id) => !was.includes(id)) : [];
      if (entered.length > 0) {
        setArriving((current) => new Set([...current, ...entered]));
        later(ARRIVING_CARD_MS, () => {
          setArriving((current) => new Set([...current].filter((id) => !entered.includes(id))));
        });
      }
    });
    return () => {
      unsubscribe();
      for (const handle of timers) window.clearTimeout(handle);
    };
  }, [store, column, animateArrivals]);

  return { leaving, arriving };
}
