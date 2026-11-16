import { MICROSECONDS_PER_SECOND, type Rules } from '../core/rules.ts';

const seconds = (value: number): number => value * MICROSECONDS_PER_SECOND;

/** Approved starting balance of the current version (docs/v0.2/prototype.md, "Стартовая экономика Prototype v0.2"). */
export const balance: Rules = {
  initialCredits: 0,
  rewardMultiplier: 1,

  taskTitleKey: 'anotherTask',
  scenarioTasks: [
    { complexity: 10, firstReview: 'pass' },
    { complexity: 15, firstReview: 'pass' },
    { complexity: 20, firstReview: 'return' },
  ],
  regularTaskComplexity: { min: 10, max: 50 },

  spawner: {
    intervalUs: seconds(2),
    toDoLimit: 5,
    boardLimit: 10,
  },

  clickPower: { base: 1, perKeyboardLevel: 1 },

  ai: {
    baseWorkPower: 2,
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
    durationUs: seconds(5),
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
      baseCost: 30,
      costGrowth: { numerator: 8, denominator: 5 },
      requiresAiDeveloper: false,
    },
    aiDeveloper: { baseCost: 1000, requiresAiDeveloper: false },
    autoAssign: { baseCost: 200, requiresAiDeveloper: false },
    autoSubmit: { baseCost: 400, requiresAiDeveloper: false },
    autoComplete: { baseCost: 600, requiresAiDeveloper: false },
    aiWorkPower: {
      baseCost: 1000,
      costGrowth: { numerator: 13, denominator: 10 },
      requiresAiDeveloper: true,
    },
    aiTickSpeed: {
      baseCost: 1000,
      costGrowth: { numerator: 3, denominator: 2 },
      requiresAiDeveloper: true,
    },
    parallelProcessing: {
      baseCost: 5000,
      costGrowth: { numerator: 11, denominator: 5 },
      requiresAiDeveloper: true,
    },
  },
};
