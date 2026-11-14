import { useTranslation } from 'react-i18next';
import { useJournal } from '../GameContext.tsx';
import styles from './Journal.module.css';
import { useJournalMessage } from './useJournalMessage.ts';

export function JournalPanel() {
  const { t } = useTranslation();
  const journal = useJournal();
  const message = useJournalMessage();
  if (journal.length === 0) return null;
  return (
    <section className={styles.panel} aria-label={t('journal.title')}>
      <h2 className={styles.title}>{t('journal.title')}</h2>
      <ol className={styles.list}>
        {journal.toReversed().map((entry) => (
          <li key={entry.id} className={styles.entry}>
            {message(entry)}
          </li>
        ))}
      </ol>
    </section>
  );
}
