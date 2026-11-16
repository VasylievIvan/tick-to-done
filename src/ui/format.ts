import type { CardId } from '../core/state.ts';

const TASK_NUMBER_MIN_DIGITS = 4;

/** Four digits is the minimum width: Task 0001 … Task 9999, then Task 10000. */
export function formatTaskNumber(number: CardId): string {
  return String(number).padStart(TASK_NUMBER_MIN_DIGITS, '0');
}
