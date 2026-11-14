import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Over,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { columnOf } from '../../core/selectors.ts';
import { columnIds, type ColumnId, type GameState } from '../../core/state.ts';
import { useDispatch, useGame, useGameList, useGameStore } from '../GameContext.tsx';
import { useTaskLabel } from '../useTaskLabel.ts';
import styles from './Board.module.css';
import { CardView } from './CardView.tsx';
import { Column, type ColumnDropState } from './Column.tsx';
import {
  boardCollisionDetection,
  dropCommand,
  insertionIndex,
  isDropAllowed,
  readCardId,
  readDropData,
  targetColumn,
  type DragOrigin,
  type DropTarget,
} from './dnd.ts';

interface DragState {
  readonly origin: DragOrigin;
  readonly target: DropTarget | null;
}

function isColumnVisible(column: ColumnId, revealed: GameState['scenario']['revealed']): boolean {
  if (column === 'review') return revealed.codeReview;
  if (column === 'done') return revealed.done;
  return true;
}

function readTarget(over: Over | null, event: DragMoveEvent | DragEndEvent): DropTarget | null {
  if (!over) return null;
  const data = readDropData(over.data.current);
  if (!data) return null;
  const card = readCardId(over.id);
  if (data.kind === 'column' || card === null) return { kind: 'column', column: data.column };
  const dragged = event.active.rect.current.translated;
  const placeBelow = dragged !== null && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
  return { kind: 'card', card, placeBelow };
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'column' || b.kind === 'column') return a.kind === b.kind && targetKey(a) === targetKey(b);
  return a.card === b.card && a.placeBelow === b.placeBelow;
}

function targetKey(target: DropTarget): string {
  return target.kind === 'column' ? target.column : `${target.card}`;
}

export function Board() {
  const { t } = useTranslation();
  const taskLabel = useTaskLabel();
  const store = useGameStore();
  const dispatch = useDispatch();
  const columns = useGame((game) => game.columns);
  const revealed = useGame((game) => game.scenario.revealed);
  const [drag, setDrag] = useState<DragState | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const allowedColumns = useGameList((game) =>
    drag ? columnIds.filter((column) => isDropAllowed(game, drag.origin, column)) : [],
  );
  const hoveredColumn = useGame((game) => (drag?.target ? targetColumn(game, drag.target) : null));
  const marker = useGame((game) => (drag?.target ? insertionIndex(game, drag.origin, drag.target) : null));
  const draggedCard = useGame((game) => (drag ? game.cards[drag.origin.card] : undefined));
  const draggedColumn = useGame((game) => (drag ? columnOf(game, drag.origin.card) : null));

  const columnName = (id: UniqueIdentifier | undefined, over: Over | null) => {
    const column = readDropData(over?.data.current)?.column;
    const card = id === undefined ? null : readCardId(id);
    return { card: card === null ? '' : taskLabel(card), column: column ? t(`board.column.${column}`) : '' };
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('board.dnd.pickedUp', columnName(active.id, null)),
    onDragOver: ({ active, over }) =>
      over ? t('board.dnd.overColumn', columnName(active.id, over)) : t('board.dnd.overNothing', columnName(active.id, null)),
    onDragEnd: ({ active }) => t('board.dnd.dropped', columnName(active.id, null)),
    onDragCancel: ({ active }) => t('board.dnd.cancelled', columnName(active.id, null)),
  };

  function handleDragStart(event: DragStartEvent) {
    const card = readCardId(event.active.id);
    const column = card === null ? null : columnOf(store.getState().game, card);
    setDrag(card === null || column === null ? null : { origin: { card, column }, target: null });
  }

  function handleDragMove(event: DragMoveEvent) {
    const target = readTarget(event.over, event);
    setDrag((current) => (current === null || sameTarget(current.target, target) ? current : { ...current, target }));
  }

  function handleDragEnd(event: DragEndEvent) {
    const origin = drag?.origin;
    setDrag(null);
    const target = readTarget(event.over, event);
    if (!origin || !target) return;
    const command = dropCommand(store.getState().game, origin, target);
    if (command) dispatch(command);
  }

  function dropStateOf(column: ColumnId): ColumnDropState {
    if (column === drag?.origin.column || !allowedColumns.includes(column)) return 'idle';
    return hoveredColumn === column ? 'active' : 'allowed';
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('board.dnd.instructions') } }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDrag(null);
      }}
    >
      <div className={styles.board}>
        {columnIds
          .filter((column) => isColumnVisible(column, revealed))
          .map((column) => (
            <Column
              key={column}
              column={column}
              cards={columns[column]}
              dropState={dropStateOf(column)}
              insertionIndex={hoveredColumn === column && column !== drag?.origin.column ? marker : null}
            />
          ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {draggedCard && draggedColumn ? <CardView card={draggedCard} column={draggedColumn} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
