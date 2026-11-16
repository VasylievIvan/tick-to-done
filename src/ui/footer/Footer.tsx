import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewGame } from '../GameContext.tsx';
import styles from './Footer.module.css';
import { ResetDialog } from './ResetDialog.tsx';

const REPOSITORY_URL = 'https://github.com/VasylievIvan/tick-to-done';

export function Footer() {
  const { t } = useTranslation();
  const newGame = useNewGame();
  const [confirming, setConfirming] = useState(false);
  const cancel = useCallback(() => {
    setConfirming(false);
  }, []);
  return (
    <footer className={styles.footer}>
      <span>{t('footer.version', { name: t('app.title'), version: __APP_VERSION__ })}</span>
      <span className={styles.separator} aria-hidden="true">
        {t('footer.separator')}
      </span>
      <span>{t('footer.stage')}</span>
      <div className={styles.end}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t('footer.reset.open')}
        </button>
        <a className={styles.link} href={REPOSITORY_URL} target="_blank" rel="noreferrer">
          {t('footer.source')}
        </a>
      </div>
      {confirming && (
        <ResetDialog
          onCancel={cancel}
          onConfirm={() => {
            setConfirming(false);
            newGame();
          }}
        />
      )}
    </footer>
  );
}
