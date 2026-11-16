import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

interface ResetDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetDialog({ onConfirm, onCancel }: ResetDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const textId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
        <h2 id={titleId} className={styles.dialogTitle}>
          {t('footer.reset.title')}
        </h2>
        <p id={textId} className={styles.dialogText}>
          {t('footer.reset.text')}
        </p>
        <div className={styles.dialogActions}>
          <button ref={cancelRef} type="button" className={styles.secondary} onClick={onCancel}>
            {t('footer.reset.cancel')}
          </button>
          <button type="button" className={styles.danger} onClick={onConfirm}>
            {t('footer.reset.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
