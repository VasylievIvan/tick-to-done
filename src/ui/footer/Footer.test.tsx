import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TestSession } from '../../core/testing.ts';
import { renderGame } from '../../test/renderGame.tsx';
import { Footer } from './Footer.tsx';

const renderMidGame = () => renderGame(new TestSession(3).completeScriptedTasks().state, <Footer />);

describe('footer', () => {
  it('shows the version, the stage and the GitHub link', () => {
    renderMidGame();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Tick to Done v\d+\.\d+\.\d+/);
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/VasylievIvan/tick-to-done');
  });

  it('asks before resetting and keeps the game when the player cancels', () => {
    const { store } = renderMidGame();
    const before = store.getState().game;
    fireEvent.click(screen.getByRole('button', { name: 'Reset progress' }));
    expect(screen.getByRole('alertdialog', { name: 'Reset progress?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(store.getState().game).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'Reset progress' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(store.getState().game).toBe(before);
  });

  it('starts the game over once the reset is confirmed', () => {
    const { store } = renderMidGame();
    fireEvent.click(screen.getByRole('button', { name: 'Reset progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const { game } = store.getState();
    expect(game.economy.credits).toBe(0);
    expect(game.columns.todo).toEqual([1]);
    expect(game.scenario.revealed.shop).toBe(false);
  });
});
