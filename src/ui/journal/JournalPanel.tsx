import { useTranslation } from 'react-i18next';
import { useJournal } from '../GameContext.tsx';
import panel from '../Panel.module.css';
import styles from './Journal.module.css';
import { useJournalMessage } from './useJournalMessage.ts';

export function JournalPanel() {
  const { t } = useTranslation();
  const journal = useJournal();
  const message = useJournalMessage();
  if (journal.length === 0) return null;
  return (
    <section className={panel.panel} aria-label={t('journal.title')}>
      <h2 className={panel.title}>{t('journal.title')}</h2>
      <ol className={[panel.list, styles.scroll].join(' ')}>
        {journal.toReversed().map((entry) => (
          <li key={entry.id} className={styles.entry}>
            {message(entry)}
          </li>
        ))}
      </ol>
    </section>
  );
}
