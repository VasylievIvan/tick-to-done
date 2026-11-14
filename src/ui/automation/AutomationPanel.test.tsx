import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { boardWith } from '../../core/testing.ts';
import { renderGame } from '../../test/renderGame.tsx';
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
    expect(row.getByText('4 work per tick · tick 1 s · 1 at once')).toBeInTheDocument();
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
  it('show one ring per bought automation in pipeline order, each running on its own', () => {
    const state = boardWith({ todo: [{ complexity: 20 }], inProgress: [{ complexity: 10, implementationDone: 10 }] }, (draft) => {
      draft.upgrades.owned.autoAssign = true;
      draft.upgrades.owned.autoSubmit = true;
      draft.upgrades.owned.autoComplete = true;
    });
    const { store } = renderGame(state, <AutomationPanel />);
    const panel = screen.getByRole('region', { name: 'Automation' });
    expect([...panel.querySelectorAll('li')].map((li) => li.getAttribute('data-automation'))).toEqual([
      'autoAssign',
      'autoSubmit',
      'autoComplete',
    ]);
    act(() => {
      store.getState().advance(500_000);
    });
    const ring = (name: string) => within(panel).getByRole('progressbar', { name: `${name} timer` });
    expect(ring('Auto Assign')).toHaveAttribute('aria-valuenow', '50');
    expect(ring('Auto Submit')).toHaveAttribute('aria-valuenow', '50');
    expect(ring('Auto Complete')).toHaveAttribute('aria-valuenow', '0');
    expect(within(panel).getAllByText('Idle')).toHaveLength(1);
  });
});
