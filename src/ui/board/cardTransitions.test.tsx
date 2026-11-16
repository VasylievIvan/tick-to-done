import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boardWith, type CardSetup } from '../../core/testing.ts';
import { renderGame } from '../../test/renderGame.tsx';
import { GameScreen } from '../GameScreen.tsx';
import { ARRIVING_CARD_MS, LEAVING_CARD_MS } from './useCardTransitions.ts';

const finished: CardSetup = { complexity: 10, implementationDone: 10 };
// Card 1 waits in Code Review; cards 2–6 fill Done, and 6 is the oldest, at the bottom.
const fullDone = () =>
  boardWith({ review: [{ ...finished, review: { status: 'accepted' } }], done: [finished, finished, finished, finished, finished] });

const done = () => within(screen.getByRole('region', { name: 'Done' }));
const leavingCard = (card: number) => document.querySelector(`[data-leaving] article[data-card="${String(card)}"]`);

describe('a card leaving Done', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays on screen fading out for a second after the core drops it', () => {
    const { store } = renderGame(fullDone(), <GameScreen />);
    act(() => {
      store.getState().dispatch({ type: 'moveCard', card: 1, from: 'review', to: 'done', index: 0 });
    });
    expect(store.getState().game.cards[6]).toBeUndefined();
    expect(leavingCard(6)).not.toBeNull();
    expect(done().getByLabelText('5 cards')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(LEAVING_CARD_MS - 1);
    });
    expect(leavingCard(6)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(leavingCard(6)).toBeNull();
    expect(done().getAllByRole('article')).toHaveLength(5);
  });

  it('does not fade the cards of a game that a reset throws away', () => {
    const { store } = renderGame(fullDone(), <GameScreen />);
    act(() => {
      store.getState().newGame();
    });
    expect(document.querySelector('[data-leaving]')).toBeNull();
  });

  it('plays an arrival for the card that has just entered Done, and only for it', () => {
    const { store } = renderGame(fullDone(), <GameScreen />);
    expect(document.querySelector('[data-arriving]')).toBeNull();
    act(() => {
      store.getState().dispatch({ type: 'moveCard', card: 1, from: 'review', to: 'done', index: 0 });
    });
    const arriving = [...document.querySelectorAll('[data-arriving] article')].map((card) => card.getAttribute('data-card'));
    expect(arriving).toEqual(['1']);
    act(() => {
      vi.advanceTimersByTime(ARRIVING_CARD_MS);
    });
    expect(document.querySelector('[data-arriving]')).toBeNull();
    expect(done().getAllByRole('article')[0]).toHaveAttribute('data-card', '1');
  });
});
