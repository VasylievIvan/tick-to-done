/** A ratio kept as two integers so that rounding rules apply to exact values, not to binary fractions. */
export interface Fraction {
  readonly numerator: number;
  readonly denominator: number;
}

export const MICROSECONDS_PER_SECOND = 1_000_000;

export type ScriptedReviewOutcome = 'pass' | 'return';

export const taskTitleKeys = ['anotherTask'] as const;
export type TaskTitleKey = (typeof taskTitleKeys)[number];

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

export const repeatableUpgradeIds = ['betterKeyboard', 'aiWorkPower', 'aiTickSpeed', 'parallelProcessing'] as const;

export type RepeatableUpgradeId = (typeof repeatableUpgradeIds)[number];

export type OneTimeUpgradeId = Exclude<UpgradeId, RepeatableUpgradeId>;

export interface RepeatableUpgradeRules {
  readonly baseCost: number;
  readonly costGrowth: Fraction;
  readonly requiresAiDeveloper: boolean;
}

export interface OneTimeUpgradeRules {
  readonly baseCost: number;
  readonly requiresAiDeveloper: boolean;
}

export interface ScenarioTaskRules {
  readonly complexity: number;
  readonly firstReview: ScriptedReviewOutcome;
}

/**
 * Every number of the game rules. The core never reads a fixed balance: each entry point receives a value of this
 * type, so the approved balance, the test set and simulation variants are interchangeable.
 */
export interface Rules {
  readonly initialCredits: number;
  readonly rewardMultiplier: number;

  readonly taskTitleKey: TaskTitleKey;
  readonly scenarioTasks: readonly [ScenarioTaskRules, ...ScenarioTaskRules[]];
  readonly regularTaskComplexity: { readonly min: number; readonly max: number };

  readonly spawner: {
    readonly intervalUs: number;
    readonly toDoLimit: number;
    readonly boardLimit: number;
  };

  readonly clickPower: { readonly base: number; readonly perKeyboardLevel: number };

  readonly ai: {
    readonly baseWorkPower: number;
    readonly workPowerPerLevel: number;
    readonly baseTickIntervalUs: number;
    readonly tickIntervalFactorPerLevel: Fraction;
    readonly minTickIntervalUs: number;
    readonly baseParallelTasks: number;
    readonly parallelTasksPerLevel: number;
  };

  readonly moves: {
    readonly autoAssignIntervalUs: number;
    readonly autoSubmitIntervalUs: number;
    readonly autoCompleteIntervalUs: number;
  };

  readonly review: {
    readonly durationUs: number;
    readonly returnProbability: Fraction;
    readonly reworkFactor: { readonly min: Fraction; readonly max: Fraction };
  };

  readonly done: { readonly maxCards: number };

  readonly discoveryThreshold: Fraction;

  readonly upgrades: { readonly [K in RepeatableUpgradeId]: RepeatableUpgradeRules } & {
    readonly [K in OneTimeUpgradeId]: OneTimeUpgradeRules;
  };
}
