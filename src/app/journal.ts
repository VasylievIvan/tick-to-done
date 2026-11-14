import { technical } from '../config/technical.ts';
import type { GameEvent, MoveActor } from '../core/events.ts';
import type { CardId, ColumnId } from '../core/state.ts';

/** What the journal shows: moves, Review results, returns with this return's rework, and completions. */
export type JournalRecord =
  | { readonly kind: 'moved'; readonly card: CardId; readonly to: ColumnId; readonly by: MoveActor }
  | { readonly kind: 'reviewPassed'; readonly card: CardId }
  | { readonly kind: 'reviewReturned'; readonly card: CardId; readonly rework: number }
  | { readonly kind: 'completed'; readonly card: CardId; readonly by: MoveActor };

export type JournalEntry = JournalRecord & { readonly id: number };

/**
 * Work clicks, purchases, discoveries, new tasks and Done trimming stay out of the v0.1 journal. A move into Done
 * is the completion itself, so it is recorded once, as a completion by whoever made it.
 */
export function toJournalRecords(events: readonly GameEvent[]): JournalRecord[] {
  return events.flatMap((event): JournalRecord[] => {
    switch (event.type) {
      case 'cardMoved':
        return event.to === 'done' ? [] : [{ kind: 'moved', card: event.card, to: event.to, by: event.by }];
      case 'reviewPassed':
        return [{ kind: 'reviewPassed', card: event.card }];
      case 'reviewReturned':
        return [{ kind: 'reviewReturned', card: event.card, rework: event.rework }];
      case 'taskCompleted':
        return [{ kind: 'completed', card: event.card, by: event.by }];
      case 'cardCreated':
      case 'doneCardRemoved':
      case 'upgradeDiscovered':
      case 'upgradePurchased':
      case 'interfaceRevealed':
        return [];
    }
  });
}

/** Appends new records and keeps only the newest entries up to the technical limit. */
export function appendToJournal(
  journal: readonly JournalEntry[],
  records: readonly JournalRecord[],
  nextId: number,
): readonly JournalEntry[] {
  if (records.length === 0) return journal;
  const appended = [...journal, ...records.map((record, index) => ({ ...record, id: nextId + index }))];
  return appended.slice(-technical.journalLimit);
}
