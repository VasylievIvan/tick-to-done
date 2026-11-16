import { describe, expect, it } from 'vitest';
import { technical } from '../config/technical.ts';
import type { GameEvent } from '../core/events.ts';
import { TestSession } from '../core/testing.ts';
import { createInitialState } from '../core/state.ts';
import { appendToJournal, toJournalRecords, type JournalRecord } from './journal.ts';
import { createGameStore } from './store.ts';
import { testRules } from '../test/testRules.ts';

describe('journal projection', () => {
  it('keeps moves, Review results, returns with their rework and completions with the actor', () => {
    const events: GameEvent[] = [
      { type: 'cardMoved', card: 1, from: 'todo', to: 'inProgress', by: 'player' },
      { type: 'cardMoved', card: 21, from: 'inProgress', to: 'review', by: 'autoSubmit' },
      { type: 'reviewPassed', card: 1 },
      { type: 'reviewReturned', card: 21, rework: 3 },
      { type: 'cardMoved', card: 1, from: 'review', to: 'done', by: 'autoComplete' },
      { type: 'taskCompleted', card: 1, reward: 20, by: 'autoComplete' },
    ];
    expect(toJournalRecords(events)).toEqual<JournalRecord[]>([
      { kind: 'moved', card: 1, to: 'inProgress', by: 'player' },
      { kind: 'moved', card: 21, to: 'review', by: 'autoSubmit' },
      { kind: 'reviewPassed', card: 1 },
      { kind: 'reviewReturned', card: 21, rework: 3 },
      { kind: 'completed', card: 1, by: 'autoComplete' },
    ]);
  });

  it('leaves out new tasks, purchases, discoveries, reveals and Done trimming', () => {
    const events: GameEvent[] = [
      { type: 'cardCreated', card: 4, source: 'spawner' },
      { type: 'upgradePurchased', upgrade: 'betterKeyboard', cost: 30 },
      { type: 'upgradeDiscovered', upgrade: 'aiDeveloper' },
      { type: 'interfaceRevealed', element: 'shop' },
      { type: 'doneCardRemoved', card: 1 },
    ];
    expect(toJournalRecords(events)).toEqual([]);
  });

  it('records nothing for Work clicks', () => {
    const session = new TestSession(1);
    session.move(1, 'inProgress');
    const before = session.events.length;
    for (let click = 0; click < 9; click += 1) session.work(1);
    expect(toJournalRecords(session.events.slice(before))).toEqual([]);
  });

  it(`keeps the newest ${technical.journalLimit} entries`, () => {
    const records = Array.from({ length: 250 }, (_, index): JournalRecord => ({ kind: 'reviewPassed', card: index + 1 }));
    const journal = appendToJournal([], records, 0);
    expect(journal).toHaveLength(technical.journalLimit);
    expect(journal[0]).toEqual({ kind: 'reviewPassed', card: 51, id: 50 });
    expect(journal.at(-1)).toEqual({ kind: 'reviewPassed', card: 250, id: 249 });
  });
});

describe('store journal', () => {
  it('fills from player commands and from time', () => {
    const store = createGameStore(testRules, createInitialState(testRules, 1));
    const { dispatch } = store.getState();
    dispatch({ type: 'moveCard', card: 1, from: 'todo', to: 'inProgress', index: 0 });
    for (let click = 0; click < 10; click += 1) dispatch({ type: 'work', card: 1 });
    dispatch({ type: 'moveCard', card: 1, from: 'inProgress', to: 'review', index: 0 });
    store.getState().advance(2_000_000);
    dispatch({ type: 'moveCard', card: 1, from: 'review', to: 'done', index: 0 });
    expect(store.getState().journal).toEqual([
      { id: 0, kind: 'moved', card: 1, to: 'inProgress', by: 'player' },
      { id: 1, kind: 'moved', card: 1, to: 'review', by: 'player' },
      { id: 2, kind: 'reviewPassed', card: 1 },
      { id: 3, kind: 'completed', card: 1, by: 'player' },
    ]);
  });

  it('caps the journal at the technical limit during a long automatic run', () => {
    const session = new TestSession(1).completeScriptedTasks();
    const store = createGameStore(testRules, session.state);
    store.setState({
      game: {
        ...store.getState().game,
        upgrades: {
          ...store.getState().game.upgrades,
          owned: { aiDeveloper: true, autoAssign: true, autoSubmit: true, autoComplete: true },
        },
      },
    });
    store.getState().dispatch({ type: 'buyUpgrade', upgrade: 'betterKeyboard' });
    for (let second = 0; second < 600; second += 1) store.getState().advance(1_000_000);
    const { journal, journalWritten } = store.getState();
    expect(journalWritten).toBeGreaterThan(technical.journalLimit);
    expect(journal).toHaveLength(technical.journalLimit);
    expect(journal.at(-1)?.id).toBe(journalWritten - 1);
  });
});
