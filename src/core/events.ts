import type { UpgradeId } from './rules.ts';
import type { CardId, ColumnId, RevealableElement } from './state.ts';

export type MoveActor = 'player' | 'autoAssign' | 'autoSubmit' | 'autoComplete';

export type CardSource = 'scenario' | 'spawner';

/** Events carry data only; the journal and any text are produced outside the core. */
export type GameEvent =
  | { readonly type: 'cardCreated'; readonly card: CardId; readonly source: CardSource }
  | {
      readonly type: 'cardMoved';
      readonly card: CardId;
      readonly from: ColumnId;
      readonly to: ColumnId;
      readonly by: MoveActor;
    }
  | { readonly type: 'reviewPassed'; readonly card: CardId }
  | { readonly type: 'reviewReturned'; readonly card: CardId; readonly rework: number }
  | { readonly type: 'taskCompleted'; readonly card: CardId; readonly reward: number; readonly by: MoveActor }
  | { readonly type: 'doneCardRemoved'; readonly card: CardId }
  | { readonly type: 'upgradeDiscovered'; readonly upgrade: UpgradeId }
  | { readonly type: 'upgradePurchased'; readonly upgrade: UpgradeId; readonly cost: number }
  | { readonly type: 'interfaceRevealed'; readonly element: RevealableElement };

export type EventSink = GameEvent[];
