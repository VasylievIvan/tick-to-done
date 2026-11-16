import type { PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isUnfinished } from '../../core/selectors.ts';
import type { Card, ColumnId } from '../../core/state.ts';
import { useRules } from '../GameContext.tsx';
import { useTaskLabel } from '../useTaskLabel.ts';
import styles from './CardView.module.css';
import { ProgressBar } from './ProgressBar.tsx';

interface CardViewProps {
  card: Card;
  column: ColumnId;
  onWork?: () => void;
  draggable?: boolean;
  overlay?: boolean;
}

function stopDragStart(event: PointerEvent) {
  event.stopPropagation();
}

export function CardView({ card, column, onWork, draggable = false, overlay = false }: CardViewProps) {
  const { t } = useTranslation();
  const taskLabel = useTaskLabel();
  const rules = useRules();
  const returned = card.returnCount > 0 && column !== 'done';
  const showWork = column === 'inProgress' || (column === 'todo' && returned);
  const className = [styles.card, draggable && styles.draggable, overlay && styles.overlay].filter(Boolean).join(' ');

  return (
    <article className={className} data-card={card.number} data-column={column}>
      <div className={[styles.number, column === 'done' && styles.numberDone].filter(Boolean).join(' ')}>
        {taskLabel(card.number)}
      </div>
      <div className={styles.title}>{t(`card.title.${card.titleKey}`)}</div>
      {returned && <span className={[styles.lozenge, styles.returned].join(' ')}>{t('card.returned')}</span>}
      {column === 'todo' && !returned && (
        <div className={styles.meta}>{t('card.complexity', { value: card.originalComplexity })}</div>
      )}
      {showWork && (
        <ProgressBar
          label={t('card.implementation', { done: card.implementationDone, total: card.originalComplexity })}
          value={card.implementationDone}
          max={card.originalComplexity}
          tone="implementation"
        />
      )}
      {showWork && card.reworkRequired > 0 && (
        <ProgressBar
          label={t('card.rework', { done: card.reworkDone, total: card.reworkRequired })}
          value={card.reworkDone}
          max={card.reworkRequired}
          tone="rework"
        />
      )}
      {column === 'review' && card.review.status === 'running' && (
        <ProgressBar
          label={t('card.inReview')}
          value={card.review.elapsedUs}
          max={rules.review.durationUs}
          tone="review"
        />
      )}
      {column === 'review' && card.review.status === 'accepted' && (
        <span className={[styles.lozenge, styles.approved].join(' ')}>{t('card.approved')}</span>
      )}
      {column === 'inProgress' && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.work}
            disabled={!isUnfinished(card)}
            onClick={onWork}
            onPointerDown={stopDragStart}
          >
            {t('card.work')}
          </button>
        </div>
      )}
    </article>
  );
}
