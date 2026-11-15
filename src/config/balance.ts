/** A ratio kept as two integers so that rounding rules apply to exact values, not to binary fractions. */
export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

export const MICROSECONDS_PER_SECOND = 1_000_000;

const seconds = (value: number): number => value * MICROSECONDS_PER_SECOND;

export type ScriptedReviewOutcome = 'pass' | 'return';

export type TaskTitleKey = 'anotherTask';

export const upgradeIds = [
  'betterKeyboard',
  'aiDeveloper',
  'autoAssign',
  'autoSubmit',
  'autoComplete',
  'aiWorkPower',
  'aiTickSpeed',
  'parallelProcessing',
] as const;

export type UpgradeId = (typeof upgradeIds)[number];

export type RepeatableUpgradeId = 'betterKeyboard' | 'aiWorkPower' | 'aiTickSpeed' | 'parallelProcessing';

export type OneTimeUpgradeId = Exclude<UpgradeId, RepeatableUpgradeId>;

export type UpgradeDefinition =
  | {
      readonly kind: 'repeatable';
      readonly baseCost: number;
      readonly costGrowth: Fraction;
      readonly requiresAiDeveloper: boolean;
    }
  | {
      readonly kind: 'oneTime';
      readonly baseCost: number;
      readonly requiresAiDeveloper: boolean;
    };

/** Approved starting balance of Prototype v0.1 (docs/v0.1/prototype.md, "Стартовая экономика Prototype v0.1"). */
export const balance = {
  initialCredits: 0,
  rewardMultiplier: 2,

  taskTitleKey: 'anotherTask' satisfies TaskTitleKey,
  scenarioTasks: [
    { complexity: 10, firstReview: 'pass' },
    { complexity: 15, firstReview: 'pass' },
    { complexity: 20, firstReview: 'return' },
  ] as const satisfies readonly { complexity: number; firstReview: ScriptedReviewOutcome }[],
  regularTaskComplexity: { min: 10, max: 30 },

  spawner: {
    intervalUs: seconds(3),
    toDoLimit: 5,
    boardLimit: 10,
  },

  clickPower: { base: 1, perKeyboardLevel: 1 },

  ai: {
    baseWorkPower: 4,
    workPowerPerLevel: 2,
    baseTickIntervalUs: seconds(1),
    tickIntervalFactorPerLevel: { numerator: 4, denominator: 5 },
    minTickIntervalUs: seconds(0.25),
    baseParallelTasks: 1,
    parallelTasksPerLevel: 1,
  },

  moves: {
    autoAssignIntervalUs: seconds(1),
    autoSubmitIntervalUs: seconds(1),
    autoCompleteIntervalUs: seconds(1),
  },

  review: {
    durationUs: seconds(2),
    returnProbability: { numerator: 15, denominator: 100 },
    reworkFactor: {
      min: { numerator: 1, denominator: 5 },
      max: { numerator: 2, denominator: 5 },
    },
  },

  done: { maxCards: 5 },

  discoveryThreshold: { numerator: 1, denominator: 2 },

  upgrades: {
    betterKeyboard: {
      kind: 'repeatable',
      baseCost: 30,
      costGrowth: { numerator: 8, denominator: 5 },
      requiresAiDeveloper: false,
    },
    aiDeveloper: { kind: 'oneTime', baseCost: 120, requiresAiDeveloper: false },
    autoAssign: { kind: 'oneTime', baseCost: 180, requiresAiDeveloper: false },
    autoSubmit: { kind: 'oneTime', baseCost: 240, requiresAiDeveloper: false },
    autoComplete: { kind: 'oneTime', baseCost: 300, requiresAiDeveloper: false },
    aiWorkPower: {
      kind: 'repeatable',
      baseCost: 180,
      costGrowth: { numerator: 17, denominator: 10 },
      requiresAiDeveloper: true,
    },
    aiTickSpeed: {
      kind: 'repeatable',
      baseCost: 240,
      costGrowth: { numerator: 9, denominator: 5 },
      requiresAiDeveloper: true,
    },
    parallelProcessing: {
      kind: 'repeatable',
      baseCost: 480,
      costGrowth: { numerator: 11, denominator: 5 },
      requiresAiDeveloper: true,
    },
  } as const satisfies Record<UpgradeId, UpgradeDefinition>,
} as const;
