import { balance } from '../config/balance.ts';
import type { Rules } from '../core/rules.ts';

export interface BalanceVariant {
  readonly title: string;
  readonly rules: Rules;
}

/**
 * Rule sets the simulation can compare in one report: `npm run sim -- approved v01AiGrowth`. A variant is an
 * experiment for the author, never a change to the approved balance.
 */
export const balanceVariants = {
  approved: { title: 'Утверждённый баланс (src/config/balance.ts)', rules: balance },
  v01AiGrowth: {
    title: 'Утверждённый баланс с ростом цен AI-улучшений v0.1 (AI Work Power ×1,7, AI Tick Speed ×1,8)',
    rules: {
      ...balance,
      upgrades: {
        ...balance.upgrades,
        aiWorkPower: { ...balance.upgrades.aiWorkPower, costGrowth: { numerator: 17, denominator: 10 } },
        aiTickSpeed: { ...balance.upgrades.aiTickSpeed, costGrowth: { numerator: 9, denominator: 5 } },
      },
    },
  },
} satisfies Record<string, BalanceVariant>;

export type BalanceVariantId = keyof typeof balanceVariants;

export function isBalanceVariantId(value: string): value is BalanceVariantId {
  return Object.hasOwn(balanceVariants, value);
}
