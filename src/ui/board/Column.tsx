import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardId, ColumnId } from '../../core/state.ts';
import { useDispatch, useGame } from '../GameContext.tsx';
import styles from './Board.module.css';
import { CardView } from './CardView.tsx';
import { columnDroppableId, type DropData } from './dnd.ts';

export type ColumnDropState = 'idle' | 'allowed' | 'active';

interface ColumnProps {
  column: ColumnId;
  cards: readonly CardId[];
  dropState: ColumnDropState;
  insertionIndex: number | null;
}

function SortableTaskCard({ id, column }: { id: CardId; column: ColumnId }) {
  const { t } = useTranslation();
  const card = useGame((game) => game.cards[id]);
  const dispatch = useDispatch();
  const data: DropData = { kind: 'card', column };
  const { setNodeRef, attributes, listeners, transform, isDragging } = useSortable({
    id,
    data,
    transition: null,
    attributes: { roleDescription: t('board.dnd.roleDescription') },
  });
  if (!card) return null;
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? styles.placeholder : undefined}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      <CardView card={card} column={column} draggable onWork={() => dispatch({ type: 'work', card: id })} />
    </div>
  );
}

function StaticTaskCard({ id, column }: { id: CardId; column: ColumnId }) {
  const card = useGame((game) => game.cards[id]);
  return card ? <CardView card={card} column={column} /> : null;
}

export function Column({ column, cards, dropState, insertionIndex }: ColumnProps) {
  const { t, i18n } = useTranslation();
  const data: DropData = { kind: 'column', column };
  const { setNodeRef } = useDroppable({ id: columnDroppableId(column), data });
  const name = t(`board.column.${column}`);
  const sortable = column !== 'done';
  const items = cards.map((id, index) => (
    <Fragment key={id}>
      {insertionIndex === index && <div className={styles.indicator} />}
      {sortable ? <SortableTaskCard id={id} column={column} /> : <StaticTaskCard id={id} column={column} />}
    </Fragment>
  ));

  return (
    <section
      className={[styles.column, dropState !== 'idle' && styles[dropState]].filter(Boolean).join(' ')}
      aria-label={name}
      data-column={column}
    >
      <header className={styles.header}>
        <h2 className={styles.name}>{name}</h2>
        <span className={styles.count} aria-label={t('board.cardCount', { count: cards.length })}>
          {cards.length.toLocaleString(i18n.language)}
        </span>
      </header>
      <div ref={setNodeRef} className={styles.cards}>
        {sortable ? (
          <SortableContext id={column} items={[...cards]} strategy={verticalListSortingStrategy}>
            {items}
          </SortableContext>
        ) : (
          items
        )}
        {insertionIndex === cards.length && <div className={styles.indicator} />}
      </div>
    </section>
  );
}
