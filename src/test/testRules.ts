import { MICROSECONDS_PER_SECOND, type Rules } from '../core/rules.ts';

const seconds = (value: number): number => value * MICROSECONDS_PER_SECOND;

/**
 * Fixed numbers for rule tests, component tests and browser tests, independent of the approved balance in
 * src/config/balance.ts: the balance is tuned during playtests, the rules are not. Mechanics of v0.1 keep the numbers
 * of the approved v0.1 balance, so the expectations written for v0.1 stay true; a test may override single fields.
 */
export const testRules: Rules = {
  initialCredits: 0,
  rewardMultiplier: 2,

  taskTitleKey: 'anotherTask',
  scenarioTasks: [
    { complexity: 10, firstReview: 'pass' },
    { complexity: 15, firstReview: 'pass' },
    { complexity: 20, firstReview: 'return' },
  ],
  regularTaskComplexity: { min: 10, max: 30, rangeFactorPerBiggerTasksLevel: 2 },

  spawner: {
    intervalFactorPerFasterBacklogLevel: { numerator: 4, denominator: 5 },
    minIntervalUs: seconds(1),
    intervalUs: seconds(3),
    toDoLimit: 5,
    toDoLimitPerParallelLevel: 1,
    boardLimit: 10,
    boardLimitPerParallelLevel: 2,
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

  disabledUpgrades: [],

  upgrades: {
    betterKeyboard: {
      baseCost: 30,
      costGrowth: { numerator: 8, denominator: 5 },
      requiresAiDeveloper: false,
    },
    aiDeveloper: { baseCost: 120, requiresAiDeveloper: false },
    autoAssign: { baseCost: 180, requiresAiDeveloper: false },
    autoSubmit: { baseCost: 240, requiresAiDeveloper: false },
    autoComplete: { baseCost: 300, requiresAiDeveloper: false },
    aiWorkPower: {
      baseCost: 180,
      costGrowth: { numerator: 17, denominator: 10 },
      requiresAiDeveloper: true,
    },
    aiTickSpeed: {
      baseCost: 240,
      costGrowth: { numerator: 9, denominator: 5 },
      requiresAiDeveloper: true,
    },
    parallelProcessing: {
      baseCost: 480,
      costGrowth: { numerator: 11, denominator: 5 },
      requiresAiDeveloper: true,
    },
    fasterBacklog: {
      baseCost: 1500,
      costGrowth: { numerator: 2, denominator: 1 },
      requiresAiDeveloper: false,
    },
    biggerTasks: {
      baseCost: 2000,
      costGrowth: { numerator: 2, denominator: 1 },
      requiresAiDeveloper: false,
    },
  },
};
