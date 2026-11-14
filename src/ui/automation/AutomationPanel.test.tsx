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
