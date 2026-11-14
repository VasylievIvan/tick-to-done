import { technical } from '../config/technical.ts';
import type { CardId } from '../core/state.ts';

/** Four digits is the minimum width: Task 0001 … Task 9999, then Task 10000. */
export function formatTaskNumber(number: CardId): string {
  return String(number).padStart(technical.taskNumberMinDigits, '0');
}
