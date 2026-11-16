import type { Draft } from 'immer';
import { describe, expect, it } from 'vitest';
import { upgradeIds } from './rules.ts';
import { testRules } from '../test/testRules.ts';
import { aiTickIntervalUs, aiWorkPower, canBuyUpgrade, parallelTasks, visibleUpgrades } from './selectors.ts';
import type { GameState } from './state.ts';
import { boardWith, TestSession, type CardSetup } from './testing.ts';

const TICK_US = testRules.ai.baseTickIntervalUs;

function withAi(levels: Partial<GameState['upgrades']['levels']> = {}, credits = 0) {
  return (draft: Draft<GameState>) => {
    draft.upgrades.owned.aiDeveloper = true;
    Object.assign(draft.upgrades.levels, levels);
    draft.economy.credits = credits;
    for (const id of upgradeIds) draft.upgrades.discovered[id] = true;
  };
}

const fresh = (complexity = 20): CardSetup => ({ complexity });
const finished: CardSetup = { complexity: 10, implementationDone: 10 };

describe('AI Developer tick', () => {
  it('does nothing before AI Developer is bought', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh()] }));
    expect(session.state.timers.aiDeveloper).toEqual({ active: false, elapsedUs: 0 });
    session.advance(TICK_US * 5);
    expect(session.card(1).implementationDone).toBe(0);
  });

  it('adds AIWorkPower to the top unfinished card only at the discrete tick', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh()] }, withAi()));
    expect(session.state.timers.aiDeveloper).toEqual({ active: true, elapsedUs: 0 });
    session.advance(TICK_US - 1);
    expect(session.card(1).implementationDone).toBe(0);
    session.advance(1);
    expect(session.card(1).implementationDone).toBe(4);
    session.advance(TICK_US * 2);
    expect(session.card(1).implementationDone).toBe(12);
  });

  it('starts work right after the purchase with a full interval', () => {
    const session = new TestSession(
      boardWith({ inProgress: [fresh()] }, (draft) => {
        draft.economy.credits = 120;
        draft.upgrades.discovered.aiDeveloper = true;
      }),
    );
    session.advance(400_000);
    expect(session.command({ type: 'buyUpgrade', upgrade: 'aiDeveloper' })).toBe(true);
    expect(session.state.timers.aiDeveloper).toEqual({ active: true, elapsedUs: 0 });
    session.advance(TICK_US);
    expect(session.card(1).implementationDone).toBe(4);
  });

  it('skips finished cards and loses power beyond the remaining work', () => {
    const almostDone: CardSetup = { complexity: 10, implementationDone: 7 };
    const session = new TestSession(boardWith({ inProgress: [finished, almostDone, fresh()] }, withAi({ aiWorkPower: 3 })));
    expect(aiWorkPower(session.state, testRules)).toBe(10);
    session.advance(TICK_US);
    expect(session.card(1).implementationDone).toBe(10);
    expect(session.card(2).implementationDone).toBe(10);
    expect(session.card(3).implementationDone).toBe(0);
    session.advance(TICK_US);
    expect(session.card(3).implementationDone).toBe(10);
  });

  it('gives every selected card the full power and picks at most ParallelTasks from the top', () => {
    const session = new TestSession(
      boardWith({ inProgress: [fresh(), finished, fresh(), fresh()] }, withAi({ parallelProcessing: 1 })),
    );
    expect(parallelTasks(session.state, testRules)).toBe(2);
    session.advance(TICK_US);
    expect([1, 3, 4].map((id) => session.card(id).implementationDone)).toEqual([4, 4, 0]);
  });

  it('follows the manual order of In Progress', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh(), fresh()] }, withAi()));
    session.command({ type: 'reorderCard', card: 2, column: 'inProgress', index: 0 });
    session.advance(TICK_US);
    expect([1, 2].map((id) => session.card(id).implementationDone)).toEqual([0, 4]);
  });

  it('works on rework as current work', () => {
    const returned: CardSetup = { complexity: 20, implementationDone: 20, reworkRequired: 6, reworkDone: 4, returnCount: 1 };
    const session = new TestSession(boardWith({ inProgress: [returned] }, withAi()));
    session.advance(TICK_US);
    expect(session.card(1)).toMatchObject({ implementationDone: 20, reworkDone: 6, reworkRequired: 6 });
    expect(session.state.timers.aiDeveloper).toEqual({ active: false, elapsedUs: 0 });
  });

  it('stops and resets without unfinished work and restarts with a full interval', () => {
    const session = new TestSession(boardWith({ todo: [fresh()], inProgress: [{ complexity: 10, implementationDone: 8 }] }, withAi()));
    session.advance(TICK_US);
    expect(session.state.timers.aiDeveloper).toEqual({ active: false, elapsedUs: 0 });
    session.advance(5_000_000);
    expect(session.state.timers.aiDeveloper).toEqual({ active: false, elapsedUs: 0 });
    session.move(1, 'inProgress');
    expect(session.state.timers.aiDeveloper).toEqual({ active: true, elapsedUs: 0 });
    session.advance(TICK_US - 1);
    expect(session.card(1).implementationDone).toBe(0);
    session.advance(1);
    expect(session.card(1).implementationDone).toBe(4);
  });

  it('resets the tick when the player finishes the last unfinished card by hand', () => {
    const session = new TestSession(boardWith({ inProgress: [{ complexity: 10, implementationDone: 9 }] }, withAi()));
    session.advance(600_000);
    session.work(1);
    expect(session.state.timers.aiDeveloper).toEqual({ active: false, elapsedUs: 0 });
  });
});

describe('player alongside the AI', () => {
  it('lets Work clicks help the card the AI is working on', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh()] }, withAi()));
    session.work(1);
    session.work(1);
    session.advance(TICK_US);
    expect(session.card(1).implementationDone).toBe(6);
  });

  it('accepts manual cards beyond ParallelTasks; the AI still takes only the top ones', () => {
    const session = new TestSession(boardWith({ todo: [fresh(), fresh(), fresh()] }, withAi()));
    for (const id of [1, 2, 3]) expect(session.move(id, 'inProgress')).toBe(true);
    expect(session.state.columns.inProgress).toEqual([1, 2, 3]);
    session.advance(TICK_US);
    expect([1, 2, 3].map((id) => session.card(id).implementationDone)).toEqual([4, 0, 0]);
    expect(session.work(3)).toBe(true);
  });
});

describe('AI upgrades', () => {
  it('stay hidden until AI Developer is bought, then appear where the threshold was reached', () => {
    const before = boardWith({}, (draft) => {
      draft.economy.credits = 300;
      for (const id of upgradeIds) draft.upgrades.discovered[id] = true;
    });
    expect(visibleUpgrades(before, testRules)).not.toContain('aiWorkPower');
    expect(visibleUpgrades(before, testRules)).not.toContain('aiTickSpeed');
    expect(visibleUpgrades(before, testRules)).not.toContain('parallelProcessing');
    const session = new TestSession(before);
    session.command({ type: 'buyUpgrade', upgrade: 'aiDeveloper' });
    expect(visibleUpgrades(session.state, testRules)).toEqual(expect.arrayContaining(['aiWorkPower', 'aiTickSpeed', 'parallelProcessing']));
  });

  it('AI Work Power adds 2 per level', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh(30)] }, withAi({}, 180)));
    session.command({ type: 'buyUpgrade', upgrade: 'aiWorkPower' });
    session.advance(TICK_US);
    expect(session.card(1).implementationDone).toBe(6);
  });

  it('Parallel Processing adds a slot', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh(), fresh()] }, withAi({}, 480)));
    session.command({ type: 'buyUpgrade', upgrade: 'parallelProcessing' });
    session.advance(TICK_US);
    expect([1, 2].map((id) => session.card(id).implementationDone)).toEqual([4, 4]);
  });

  it('AI Tick Speed speeds up the running tick and keeps the filled share', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh(30)] }, withAi({}, 240)));
    session.advance(600_000);
    expect(session.state.timers.aiDeveloper.elapsedUs).toBe(600_000);
    const purchase = session.command({ type: 'buyUpgrade', upgrade: 'aiTickSpeed' });
    expect(purchase).toBe(true);
    expect(aiTickIntervalUs(session.state, testRules)).toBe(800_000);
    expect(session.state.timers.aiDeveloper).toEqual({ active: true, elapsedUs: 480_000 });
    expect(session.card(1).implementationDone).toBe(0);
    session.advance(320_000 - 1);
    expect(session.card(1).implementationDone).toBe(0);
    session.advance(1);
    expect(session.card(1).implementationDone).toBe(4);
    session.advance(800_000);
    expect(session.card(1).implementationDone).toBe(8);
  });

  it('rounds the rescaled tick down to a microsecond', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh(30)] }, withAi({ aiTickSpeed: 3 }, 10_000)));
    session.advance(333_333);
    session.command({ type: 'buyUpgrade', upgrade: 'aiTickSpeed' });
    expect(aiTickIntervalUs(session.state, testRules)).toBe(409_600);
    expect(session.state.timers.aiDeveloper.elapsedUs).toBe(Math.floor((333_333 * 409_600) / 512_000));
  });

  it('reaches 0.25 s on the seventh purchase and refuses the eighth', () => {
    const session = new TestSession(boardWith({ inProgress: [fresh(30)] }, withAi({ aiTickSpeed: 6 }, 1_000_000)));
    expect(aiTickIntervalUs(session.state, testRules)).toBe(262_144);
    expect(session.command({ type: 'buyUpgrade', upgrade: 'aiTickSpeed' })).toBe(true);
    expect(aiTickIntervalUs(session.state, testRules)).toBe(250_000);
    expect(canBuyUpgrade(session.state, testRules, 'aiTickSpeed')).toBe(false);
    expect(session.command({ type: 'buyUpgrade', upgrade: 'aiTickSpeed' })).toBe(false);
    expect(visibleUpgrades(session.state, testRules)).toContain('aiTickSpeed');
  });

  it('does not touch an idle AI timer when the speed is bought', () => {
    const session = new TestSession(boardWith({}, withAi({}, 240)));
    session.command({ type: 'buyUpgrade', upgrade: 'aiTickSpeed' });
    expect(session.state.timers.aiDeveloper).toEqual({ active: false, elapsedUs: 0 });
  });
});
