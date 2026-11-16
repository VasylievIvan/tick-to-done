import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../core/state.ts';
import { renderGame } from '../test/renderGame.tsx';
import { GameScreen } from './GameScreen.tsx';
import { testRules } from '../test/testRules.ts';

const REVIEW_US = 2_000_000;

describe('game screen', () => {
  it('starts with only To Do, In Progress and one card, and no balance', () => {
    const { container } = renderGame(createInitialState(testRules, 1), <GameScreen />);
    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
      'To Do',
      'In Progress',
    ]);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'To Do' })).getByText('Task 0001')).toBeInTheDocument();
    expect(screen.queryByTestId('credits')).toBeNull();
    expect(screen.queryByTestId('tasks-done')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('reveals Code Review, Done and the balance with the tasks-done counter at their moments', () => {
    const { store } = renderGame(createInitialState(testRules, 1), <GameScreen />);
    const { dispatch } = store.getState();

    act(() => {
      dispatch({ type: 'moveCard', card: 1, from: 'todo', to: 'inProgress', index: 0 });
    });
    const work = screen.getByRole('button', { name: 'Work' });
    for (let click = 0; click < 9; click += 1) fireEvent.click(work);
    expect(screen.queryByRole('region', { name: 'Code Review' })).toBeNull();
    fireEvent.click(work);
    expect(screen.getByRole('region', { name: 'Code Review' })).toBeInTheDocument();
    expect(work).toBeDisabled();

    act(() => {
      dispatch({ type: 'moveCard', card: 1, from: 'inProgress', to: 'review', index: 0 });
      store.getState().advance(REVIEW_US);
    });
    expect(screen.getByRole('region', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByTestId('credits')).toBeNull();

    act(() => {
      dispatch({ type: 'moveCard', card: 1, from: 'review', to: 'done', index: 0 });
    });
    expect(screen.getByTestId('credits')).toHaveTextContent('20 Credits');
    expect(screen.getByTestId('tasks-done')).toHaveTextContent('1 task done');
    expect(screen.getByTestId('top-bar')).toHaveTextContent(/^20 Credits1 task done$/);
    expect(within(screen.getByRole('region', { name: 'To Do' })).getByText('Task 0002')).toBeInTheDocument();
  });
});
