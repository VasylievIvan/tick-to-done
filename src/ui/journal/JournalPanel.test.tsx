import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JournalRecord } from '../../app/journal.ts';
import { columnIds } from '../../core/state.ts';
import { createInitialState } from '../../core/state.ts';
import { renderGame } from '../../test/renderGame.tsx';
import { JournalPanel } from './JournalPanel.tsx';
import { testRules } from '../../test/testRules.ts';

const actors = ['player', 'autoAssign', 'autoSubmit', 'autoComplete'] as const;

function renderJournal(records: readonly JournalRecord[]) {
  const { store } = renderGame(createInitialState(testRules, 1), <JournalPanel />);
  act(() => {
    store.setState({ journal: records.map((record, id) => ({ ...record, id })), journalWritten: records.length });
  });
  return store;
}

const messages = () =>
  within(screen.getByRole('region', { name: 'Activity' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('journal panel', () => {
  it('is absent while the journal is empty', () => {
    renderGame(createInitialState(testRules, 1), <JournalPanel />);
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
  });

  it('writes each entry from a dictionary template, newest first, telling the player from each automation', () => {
    renderJournal([
      { kind: 'moved', card: 1, to: 'inProgress', by: 'player' },
      { kind: 'moved', card: 21, to: 'inProgress', by: 'autoAssign' },
      { kind: 'moved', card: 21, to: 'review', by: 'autoSubmit' },
      { kind: 'reviewReturned', card: 21, rework: 3 },
      { kind: 'reviewReturned', card: 22, rework: 1 },
      { kind: 'reviewPassed', card: 1 },
      { kind: 'completed', card: 1, by: 'player' },
      { kind: 'completed', card: 21, by: 'autoComplete' },
    ]);
    expect(messages()).toEqual([
      'Auto Complete completed Task 0021',
      'You completed Task 0001',
      'Task 0001 passed review',
      'Task 0022 returned to To Do with 1 unit of rework',
      'Task 0021 returned to To Do with 3 units of rework',
      'Auto Submit sent Task 0021 to Code Review',
      'Auto Assign took Task 0021 into In Progress',
      'You moved Task 0001 to In Progress',
    ]);
  });

  it('has a template with every parameter filled for every kind, actor and column', () => {
    const records: JournalRecord[] = [
      ...actors.flatMap((by) => columnIds.map((to): JournalRecord => ({ kind: 'moved', card: 7, to, by }))),
      ...actors.map((by): JournalRecord => ({ kind: 'completed', card: 7, by })),
      { kind: 'reviewPassed', card: 7 },
      { kind: 'reviewReturned', card: 7, rework: 1 },
      { kind: 'reviewReturned', card: 7, rework: 12 },
    ];
    renderJournal(records);
    const texts = messages();
    expect(texts).toHaveLength(records.length);
    for (const text of texts) {
      expect(text).toContain('Task 0007');
      expect(text).not.toMatch(/\{\{|\}\}|journal\./);
    }
  });
});
