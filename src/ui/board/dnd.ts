import { closestCenter, pointerWithin, type CollisionDetection, type UniqueIdentifier } from '@dnd-kit/core';
import { canMoveCard, canReorderCard, columnOf } from '../../core/selectors.ts';
import type { Command } from '../../core/engine.ts';
import { columnIds, type CardId, type ColumnId, type GameState } from '../../core/state.ts';

export interface DragOrigin {
  readonly card: CardId;
  readonly column: ColumnId;
}

export type DropTarget =
  | { readonly kind: 'card'; readonly card: CardId; readonly placeBelow: boolean }
  | { readonly kind: 'column'; readonly column: ColumnId };

export type DropData = { readonly kind: 'card' | 'column'; readonly column: ColumnId };

export function columnDroppableId(column: ColumnId): string {
  return `column:${column}`;
}

export function readDropData(value: unknown): DropData | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, column } = value as { kind?: unknown; column?: unknown };
  if ((kind !== 'card' && kind !== 'column') || !columnIds.some((id) => id === column)) return null;
  return { kind, column: column as ColumnId };
}

export function readCardId(id: UniqueIdentifier): CardId | null {
  return typeof id === 'number' ? id : null;
}

/**
 * The column under the pointer decides the target; inside it the nearest card is the drop reference, and an empty
 * column is a target of its own. Outside every column there is no target.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const columnHit = pointerWithin(args).find((collision) => {
    const container = args.droppableContainers.find((candidate) => candidate.id === collision.id);
    return readDropData(container?.data.current)?.kind === 'column';
  });
  if (!columnHit) return [];
  const hitContainer = args.droppableContainers.find((candidate) => candidate.id === columnHit.id);
  const column = readDropData(hitContainer?.data.current)?.column;
  const cards = args.droppableContainers.filter((container) => {
    const data = readDropData(container.data.current);
    return data?.kind === 'card' && data.column === column;
  });
  if (cards.length === 0) return [columnHit];
  return closestCenter({ ...args, droppableContainers: cards });
};

export function targetColumn(state: GameState, target: DropTarget): ColumnId | null {
  return target.kind === 'column' ? target.column : columnOf(state, target.card);
}

/**
 * Turns a finished gesture into a command. The origin is where the drag started, so if an automation or a review
 * moved the card meanwhile, the core rejects the command and the drop is cancelled.
 */
export function dropCommand(state: GameState, origin: DragOrigin, target: DropTarget): Command | null {
  const column = targetColumn(state, target);
  if (column === null) return null;
  const list = state.columns[column];

  if (column === origin.column) {
    if (target.kind === 'card' && target.card === origin.card) return null;
    const index = target.kind === 'card' ? list.indexOf(target.card) : list.length - 1;
    return { type: 'reorderCard', card: origin.card, column, index };
  }

  const index = target.kind === 'card' ? list.indexOf(target.card) + (target.placeBelow ? 1 : 0) : list.length;
  return { type: 'moveCard', card: origin.card, from: origin.column, to: column, index };
}

export function isDropAllowed(state: GameState, origin: DragOrigin, column: ColumnId): boolean {
  return column === origin.column
    ? canReorderCard(state, origin.card, column)
    : canMoveCard(state, origin.card, origin.column, column);
}

/** Where a card from another column would land, for the insertion marker; Done always takes it at the top. */
export function insertionIndex(state: GameState, origin: DragOrigin, target: DropTarget): number | null {
  const command = dropCommand(state, origin, target);
  if (command?.type !== 'moveCard' || !isDropAllowed(state, origin, command.to)) return null;
  return command.to === 'done' ? 0 : command.index;
}
