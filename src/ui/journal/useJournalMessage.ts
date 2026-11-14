import { useTranslation } from 'react-i18next';
import type { JournalRecord } from '../../app/journal.ts';
import { useTaskLabel } from '../useTaskLabel.ts';

export function useJournalMessage(): (record: JournalRecord) => string {
  const { t } = useTranslation();
  const taskLabel = useTaskLabel();
  return (record) => {
    const card = taskLabel(record.card);
    switch (record.kind) {
      case 'moved':
        return t(`journal.moved.${record.by}`, { card, column: t(`board.column.${record.to}`) });
      case 'reviewPassed':
        return t('journal.reviewPassed', { card });
      case 'reviewReturned':
        return t('journal.reviewReturned', { card, column: t('board.column.todo'), count: record.rework });
      case 'completed':
        return t(`journal.completed.${record.by}`, { card });
    }
  };
}
