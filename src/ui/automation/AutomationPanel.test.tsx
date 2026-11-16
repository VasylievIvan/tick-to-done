import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { boardWith } from '../../core/testing.ts';
import { renderGame } from '../../test/renderGame.tsx';
import { GameScreen } from '../GameScreen.tsx';
import { AutomationPanel } from './AutomationPanel.tsx';

describe('automation panel', () => {
  it('is absent until AI Developer is bought', () => {
    renderGame(boardWith({ inProgress: [{ complexity: 20 }] }), <AutomationPanel />);
    expect(screen.queryByRole('region', { name: 'Automation' })).toBeNull();
  });

  it('shows the AI tick filling only while there is unfinished work', () => {
    const state = boardWith({ inProgress: [{ complexity: 20 }] }, (draft) => {
      draft.upgrades.owned.aiDeveloper = true;
    });
    const { store } = renderGame(state, <AutomationPanel />);
    const row = within(screen.getByRole('region', { name: 'Automation' }));
    const ring = row.getByRole('progressbar', { name: 'AI Developer timer' });
    expect(row.getByText('Working')).toBeInTheDocument();
    expect(row.getByText('Work per tick: 4')).toBeInTheDocument();
    expect(row.getByText('Tick: 1 s')).toBeInTheDocument();
    expect(row.getByText('Tasks at once: 1')).toBeInTheDocument();
    expect(ring).toHaveAttribute('aria-valuenow', '0');

    act(() => {
      store.getState().advance(250_000);
    });
    expect(ring).toHaveAttribute('aria-valuenow', '25');

    act(() => {
      store.getState().advance(750_000 + 4_000_000);
    });
    expect(row.getByText('Idle')).toBeInTheDocument();
    expect(ring).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('move automation timers', () => {
  it('stay out of the Automation panel and tick in the header of the column each one takes cards from', () => {
    const state = boardWith(
      {
        todo: [{ complexity: 20 }],
        inProgress: [{ complexity: 10, implementationDone: 10 }],
        review: [{ complexity: 10, implementationDone: 10, review: { status: 'running', elapsedUs: 0 } }],
      },
      (draft) => {
        draft.upgrades.owned.autoAssign = true;
        draft.upgrades.owned.autoSubmit = true;
        draft.upgrades.owned.autoComplete = true;
      },
    );
    const { store } = renderGame(state, <GameScreen />);
    expect(screen.queryByRole('region', { name: 'Automation' })).toBeNull();

    const ring = (column: string, name: string) =>
      within(screen.getByRole('region', { name: column })).getByRole('progressbar', { name: `${name} timer` });
    act(() => {
      store.getState().advance(500_000);
    });
    expect(ring('To Do', 'Auto Assign')).toHaveAttribute('aria-valuenow', '50');
    expect(ring('In Progress', 'Auto Submit')).toHaveAttribute('aria-valuenow', '50');
    expect(ring('Code Review', 'Auto Complete')).toHaveAttribute('aria-valuenow', '0');
    expect(within(screen.getByRole('region', { name: 'Done' })).queryByRole('progressbar')).toBeNull();
  });

  it('shows no ring in a column whose automation is not bought', () => {
    renderGame(boardWith({ todo: [{ complexity: 20 }] }), <GameScreen />);
    expect(within(screen.getByRole('region', { name: 'To Do' })).queryByRole('progressbar')).toBeNull();
  });
});
