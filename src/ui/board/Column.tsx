import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Fragment, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { timerProgress } from '../../core/selectors.ts';
import type { CardId, ColumnId } from '../../core/state.ts';
import { TimerRing } from '../automation/TimerRing.tsx';
import { useDispatch, useGame } from '../GameContext.tsx';
import styles from './Board.module.css';
import { CardView } from './CardView.tsx';
import { columnDroppableId, type DropData } from './dnd.ts';
import { ARRIVING_CARD_MS, LEAVING_CARD_MS, useCardTransitions } from './useCardTransitions.ts';

export type ColumnDropState = 'idle' | 'allowed' | 'active';

type MoveAutomation = 'autoAssign' | 'autoSubmit' | 'autoComplete';

/** Each card move is timed in the header of the column it takes cards from. */
const moveAutomationFrom: Partial<Record<ColumnId, MoveAutomation>> = {
  todo: 'autoAssign',
  inProgress: 'autoSubmit',
  review: 'autoComplete',
};

function MoveTimer({ id }: { id: MoveAutomation }) {
  const { t } = useTranslation();
  const owned = useGame((game) => game.upgrades.owned[id]);
  const progress = useGame((game, rules) => timerProgress(game, rules, id));
  const active = useGame((game) => game.timers[id].active);
  if (!owned) return null;
  const label = t('automation.timer', { name: t(`shop.upgrade.${id}.name`) });
  return (
    <span className={styles.timer} data-automation={id}>
      <TimerRing progress={progress} active={active} label={label} size="mini" />
    </span>
  );
}

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
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    data,
    // Neighbours slide aside only while the player drags (decision F3); moves made by the game itself and the
    // settling after a drop stay instant, because animated card moves are deferred beyond v0.1.
    animateLayoutChanges: () => false,
    attributes: { roleDescription: t('board.dnd.roleDescription') },
  });
  if (!card) return null;
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? styles.placeholder : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <CardView card={card} column={column} draggable onWork={() => dispatch({ type: 'work', card: id })} />
    </div>
  );
}

const leavingStyle = { animationDuration: `${String(LEAVING_CARD_MS)}ms` } satisfies CSSProperties;
const arrivingStyle = { '--arrive-ms': `${String(ARRIVING_CARD_MS)}ms` } as CSSProperties;

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
  const moveAutomation = moveAutomationFrom[column];
  // Only Done animates arrivals: it is where the work of a card ends.
  const animatesArrival = column === 'done';
  const { leaving, arriving } = useCardTransitions(column, animatesArrival);
  const items = cards.map((id, index) => (
    <Fragment key={id}>
      {insertionIndex === index && <div className={styles.indicator} />}
      {sortable ? (
        <SortableTaskCard id={id} column={column} />
      ) : animatesArrival && arriving.has(id) ? (
        <div className={styles.arriving} style={arrivingStyle} data-arriving="true">
          <div className={styles.arrivingCard}>
            <StaticTaskCard id={id} column={column} />
          </div>
        </div>
      ) : (
        <StaticTaskCard id={id} column={column} />
      )}
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
        {moveAutomation && <MoveTimer id={moveAutomation} />}
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
        {leaving.map((card) => (
          <div key={card.number} className={styles.leaving} style={leavingStyle} data-leaving="true" aria-hidden="true">
            <CardView card={card} column={column} />
          </div>
        ))}
      </div>
    </section>
  );
}
