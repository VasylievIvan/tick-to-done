import { fireEvent, screen, within } from '@testing-library/react';
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { upgradeIds } from '../../core/rules.ts';
import { TestSession } from '../../core/testing.ts';
import { renderGame } from '../../test/renderGame.tsx';
import { Shop } from './Shop.tsx';

function item(name: string) {
  const element = screen.getByText(name).closest('li');
  if (!element) throw new Error(`No shop item ${name}`);
  return within(element);
}

describe('shop panel', () => {
  it('lists Better Keyboard, AI Developer and Auto Assign when it opens with 90 Credits', () => {
    const state = new TestSession(1).completeScriptedTasks().state;
    renderGame(state, <Shop />);
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-upgrade'))).toEqual([
      'betterKeyboard',
      'aiDeveloper',
      'autoAssign',
    ]);
    expect(item('Better Keyboard').getByRole('button', { name: 'Buy' })).toBeEnabled();
    expect(item('Better Keyboard').getByText('30 Credits')).toBeInTheDocument();
    expect(item('Better Keyboard').getByText('Work per click: 1 → 2')).toBeInTheDocument();
    expect(item('AI Developer').getByRole('button', { name: 'Buy' })).toBeDisabled();
    expect(item('Auto Assign').getByRole('button', { name: 'Buy' })).toBeDisabled();
  });

  it('buys Better Keyboard and shows its next level and price', () => {
    const state = new TestSession(1).completeScriptedTasks().state;
    const { store } = renderGame(state, <Shop />);
    fireEvent.click(item('Better Keyboard').getByRole('button', { name: 'Buy' }));
    expect(store.getState().game.economy.credits).toBe(60);
    expect(item('Better Keyboard').getByText('Level 1')).toBeInTheDocument();
    expect(item('Better Keyboard').getByText('48 Credits')).toBeInTheDocument();
    expect(item('Better Keyboard').getByText('Work per click: 2 → 3')).toBeInTheDocument();
    expect(item('Better Keyboard').getByRole('button', { name: 'Buy' })).toBeEnabled();
  });

  it('marks bought one-time upgrades and the exhausted AI Tick Speed without a Buy button', () => {
    const base = new TestSession(1).completeScriptedTasks().state;
    const state = produce(base, (draft) => {
      for (const id of upgradeIds) draft.upgrades.discovered[id] = true;
      draft.upgrades.owned.aiDeveloper = true;
      draft.upgrades.levels.aiTickSpeed = 7;
      draft.economy.credits = 10_000;
    });
    renderGame(state, <Shop />);
    expect(item('AI Developer').getByText('Purchased')).toBeInTheDocument();
    expect(item('AI Developer').queryByRole('button')).toBeNull();
    expect(item('AI Tick Speed').getByText('Max')).toBeInTheDocument();
    expect(item('AI Tick Speed').getByText('AI tick: 0.25 s')).toBeInTheDocument();
    expect(item('AI Tick Speed').queryByRole('button')).toBeNull();
    expect(item('Parallel Processing').getByText('Tasks AI works on at once: 1 → 2')).toBeInTheDocument();
    expect(item('Parallel Processing').getByText('480 Credits')).toBeInTheDocument();
  });

  it('formats the AI tick in seconds', () => {
    const base = new TestSession(1).completeScriptedTasks().state;
    const state = produce(base, (draft) => {
      draft.upgrades.discovered.aiTickSpeed = true;
      draft.upgrades.owned.aiDeveloper = true;
      draft.upgrades.levels.aiTickSpeed = 4;
    });
    renderGame(state, <Shop />);
    expect(item('AI Tick Speed').getByText('AI tick: 0.41 s → 0.328 s')).toBeInTheDocument();
  });

  it('shows Faster Backlog as the generator interval in seconds and marks it Max at the minimum', () => {
    const base = new TestSession(1).completeScriptedTasks().state;
    const discovered = produce(base, (draft) => {
      draft.upgrades.discovered.fasterBacklog = true;
      draft.economy.credits = 10_000;
    });
    const first = renderGame(discovered, <Shop />);
    expect(item('Faster Backlog').getByText('New task every 3 s → 2.4 s')).toBeInTheDocument();
    expect(item('Faster Backlog').getByText('1,500 Credits')).toBeInTheDocument();
    expect(item('Faster Backlog').getByRole('button', { name: 'Buy' })).toBeEnabled();
    first.unmount();

    const maxed = produce(discovered, (draft) => {
      draft.upgrades.levels.fasterBacklog = 5;
    });
    renderGame(maxed, <Shop />);
    expect(item('Faster Backlog').getByText('Max')).toBeInTheDocument();
    expect(item('Faster Backlog').getByText('New task every 1 s')).toBeInTheDocument();
    expect(item('Faster Backlog').queryByRole('button')).toBeNull();
  });
});
