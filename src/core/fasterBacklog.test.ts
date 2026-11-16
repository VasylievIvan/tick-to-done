import { describe, expect, it } from 'vitest';
import { testRules } from '../test/testRules.ts';
import { isFasterBacklogMaxedAt, spawnIntervalUsAt, upgradeCost } from './economy.ts';
import { canBuyUpgrade, isUpgradeExhausted, spawnIntervalUs, timerProgress, visibleUpgrades } from './selectors.ts';
import { boardWith, TestSession } from './testing.ts';

const buy = (session: TestSession) => session.command({ type: 'buyUpgrade', upgrade: 'fasterBacklog' });

/** An empty board after the scripted tasks: the generator runs, and enough Credits for any purchase. */
function generatorRunning(levels = 0, credits = 1_000_000) {
  return new TestSession(
    boardWith({}, (draft) => {
      draft.economy.credits = credits;
      draft.upgrades.discovered.fasterBacklog = true;
      draft.upgrades.levels.fasterBacklog = levels;
    }),
  );
}

const spawned = (session: TestSession) =>
  session.events.filter((event) => event.type === 'cardCreated' && event.source === 'spawner').length;

describe('Faster Backlog', () => {
  it('shortens the generator interval ×4/5 per level in exact microseconds down to its minimum', () => {
    expect(Array.from({ length: 7 }, (_, level) => spawnIntervalUsAt(testRules, level))).toEqual([
      3_000_000, 2_400_000, 1_920_000, 1_536_000, 1_228_800, 1_000_000, 1_000_000,
    ]);
  });

  it('is exhausted exactly when the interval reaches the minimum', () => {
    expect(Array.from({ length: 7 }, (_, level) => isFasterBacklogMaxedAt(testRules, level))).toEqual([
      false, false, false, false, false, true, true,
    ]);
  });

  it('grows its price by the factor of the rules', () => {
    expect([0, 1, 2].map((level) => upgradeCost(testRules, 'fasterBacklog', level))).toEqual([1500, 3000, 6000]);
  });

  it('cannot be bought once the interval sits at the minimum, and stays listed as exhausted', () => {
    const session = generatorRunning(4);
    expect(buy(session)).toBe(true);
    expect(spawnIntervalUs(session.state, testRules)).toBe(1_000_000);
    expect(isUpgradeExhausted(session.state, testRules, 'fasterBacklog')).toBe(true);
    expect(visibleUpgrades(session.state, testRules)).toContain('fasterBacklog');
    expect(canBuyUpgrade(session.state, testRules, 'fasterBacklog')).toBe(false);
    expect(buy(session)).toBe(false);
    expect(session.state.upgrades.levels.fasterBacklog).toBe(5);
  });

  it('applies to the running generator timer at once and keeps its filled share', () => {
    const session = generatorRunning();
    session.advance(1_500_000);
    expect(timerProgress(session.state, testRules, 'spawner')).toBe(0.5);

    expect(buy(session)).toBe(true);
    expect(session.state.timers.spawner).toEqual({ active: true, elapsedUs: 1_200_000 });
    expect(timerProgress(session.state, testRules, 'spawner')).toBe(0.5);
    expect(spawned(session)).toBe(0);

    session.advance(1_199_999);
    expect(spawned(session)).toBe(0);
    session.advance(1);
    expect(spawned(session)).toBe(1);
    session.advance(2_400_000);
    expect(spawned(session)).toBe(2);
  });

  it('leaves the AI tick untouched', () => {
    const session = generatorRunning();
    const before = session.state.upgrades.levels.aiTickSpeed;
    buy(session);
    expect(session.state.upgrades.levels.aiTickSpeed).toBe(before);
  });

  it('is discovered by the general 50% rule and needs no AI Developer', () => {
    const threshold = testRules.upgrades.fasterBacklog.baseCost / 2;
    const reward = 10 * testRules.rewardMultiplier;
    const completeOneWith = (credits: number) => {
      const session = new TestSession(
        boardWith({ review: [{ complexity: 10, implementationDone: 10, review: { status: 'accepted' } }] }, (draft) => {
          draft.economy.credits = credits;
        }),
      );
      session.move(1, 'done');
      return session;
    };

    const below = completeOneWith(threshold - reward - 1);
    expect(below.state.upgrades.discovered.fasterBacklog).toBe(false);
    expect(visibleUpgrades(below.state, testRules)).not.toContain('fasterBacklog');

    const reached = completeOneWith(threshold - reward);
    expect(reached.events).toContainEqual({ type: 'upgradeDiscovered', upgrade: 'fasterBacklog' });
    expect(reached.state.upgrades.owned.aiDeveloper).toBe(false);
    expect(visibleUpgrades(reached.state, testRules)).toContain('fasterBacklog');
  });
});
