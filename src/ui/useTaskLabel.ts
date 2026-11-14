import { useTranslation } from 'react-i18next';
import type { CardId } from '../core/state.ts';
import { formatTaskNumber } from './format.ts';

export function useTaskLabel(): (card: CardId) => string {
  const { t } = useTranslation();
  return (card) => t('card.number', { number: formatTaskNumber(card) });
}
