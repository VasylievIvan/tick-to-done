import { describe, expect, it } from 'vitest';
import { balance, upgradeIds, type UpgradeId } from '../config/balance.ts';
import { isDiscoveryThresholdReached } from './economy.ts';
import { applyCommand } from './engine.ts';
import { canBuyUpgrade, clickPower, currentUpgradeCost, upgradeLevel, visibleUpgrades } from './selectors.ts';
import { boardWith, TestSession } from './testing.ts';

const buy = (session: TestSession, upgrade: UpgradeId) => session.command({ type: 'buyUpgrade', upgrade });

function shopWithCredits(credits: number) {
  return new TestSession(
    boardWith({}, (draft) => {
      draft.economy.credits = credits;
      for (const id of upgradeIds) {
        draft.upgrades.discovered[id] = isDiscoveryThresholdReached(credits, balance.upgrades[id].baseCost);
      }
    }),
  );
}

describe('shop discovery', () => {
  it('shows Better Keyboard, AI Developer and Auto Assign when the shop opens with 90 Credits', () => {
    const session = new TestSession(1).completeScriptedTasks();
    expect(session.state.economy.credits).toBe(90);
    expect(visibleUpgrades(session.state)).toEqual(['betterKeyboard', 'aiDeveloper', 'autoAssign']);
  });

  it('keeps AI Work Power hidden although its threshold is reached, until AI Developer is bought', () => {
    const session = new TestSession(1).completeScriptedTasks();
    expect(session.state.upgrades.discovered.aiWorkPower).toBe(true);
    expect(visibleUpgrades(session.state)).not.toContain('aiWorkPower');
    expect(buy(session, 'aiWorkPower')).toBe(false);
  });

  it('records thresholds before the shop opens without showing anything', () => {
    const session = new TestSession(1);
    session.completeByHand(1);
    expect(session.state.upgrades.discovered.betterKeyboard).toBe(true);
    expect(session.state.scenario.revealed.shop).toBe(false);
    expect(visibleUpgrades(session.state)).toEqual([]);
    expect(buy(session, 'betterKeyboard')).toBe(false);
  });

  it('emits a discovery event the first time a threshold is reached', () => {
    const session = new TestSession(1).completeScriptedTasks();
    const discovered = session.events.flatMap((event) => (event.type === 'upgradeDiscovered' ? [event.upgrade] : []));
    expect(discovered).toEqual(['betterKeyboard', 'aiDeveloper', 'autoAssign', 'aiWorkPower']);
  });

  it('never hides an upgrade again after spending', () => {
    const session = new TestSession(1).completeScriptedTasks();
    expect(buy(session, 'betterKeyboard')).toBe(true);
    expect(session.state.economy.credits).toBe(60);
    expect(visibleUpgrades(session.state)).toEqual(['betterKeyboard', 'aiDeveloper', 'autoAssign']);
    expect(session.state.upgrades.discovered.autoAssign).toBe(true);
  });

  it('opens visibility at half the base price, not the purchase at half price', () => {
    const session = shopWithCredits(90);
    expect(visibleUpgrades(session.state)).toContain('autoAssign');
    expect(canBuyUpgrade(session.state, 'autoAssign')).toBe(false);
    expect(buy(session, 'autoAssign')).toBe(false);
  });
});

describe('buying', () => {
  it('rejects a purchase without enough Credits and leaves the state untouched', () => {
    const session = new TestSession(1).completeScriptedTasks();
    const before = session.state;
    expect(buy(session, 'aiDeveloper')).toBe(false);
    expect(session.state).toBe(before);
  });

  it('charges the current price and raises ClickPower with Better Keyboard', () => {
    const session = new TestSession(1).completeScriptedTasks();
    expect(clickPower(session.state)).toBe(1);
    expect(buy(session, 'betterKeyboard')).toBe(true);
    expect(session.events.at(-1)).toEqual({ type: 'upgradePurchased', upgrade: 'betterKeyboard', cost: 30 });
    expect(upgradeLevel(session.state, 'betterKeyboard')).toBe(1);
    expect(clickPower(session.state)).toBe(2);
    expect(currentUpgradeCost(session.state, 'betterKeyboard')).toBe(48);
    expect(buy(session, 'betterKeyboard')).toBe(true);
    expect(session.state.economy.credits).toBe(90 - 30 - 48);
    expect(clickPower(session.state)).toBe(3);
    expect(currentUpgradeCost(session.state, 'betterKeyboard')).toBe(77);
    expect(buy(session, 'betterKeyboard')).toBe(false);
  });

  it('applies the new ClickPower to the next Work click', () => {
    const session = new TestSession(1).completeScriptedTasks();
    buy(session, 'betterKeyboard');
    session.advance(3_000_000);
    session.move(4, 'inProgress');
    session.work(4);
    expect(session.card(4).implementationDone).toBe(2);
  });

  it('sells a one-time upgrade once and keeps it listed as purchased', () => {
    const session = shopWithCredits(500);
    expect(buy(session, 'autoAssign')).toBe(true);
    expect(session.state.upgrades.owned.autoAssign).toBe(true);
    expect(visibleUpgrades(session.state)).toContain('autoAssign');
    expect(buy(session, 'autoAssign')).toBe(false);
    expect(session.state.economy.credits).toBe(320);
  });

  it('shows the AI upgrades after AI Developer only where their threshold was reached', () => {
    const session = shopWithCredits(230);
    expect(session.state.upgrades.discovered.parallelProcessing).toBe(false);
    expect(visibleUpgrades(session.state)).toEqual(['betterKeyboard', 'aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete']);
    expect(buy(session, 'aiDeveloper')).toBe(true);
    expect(visibleUpgrades(session.state)).toEqual([
      'betterKeyboard', 'aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete', 'aiWorkPower', 'aiTickSpeed',
    ]);
  });

  it('rejects unknown purchases before the shop exists', () => {
    const state = new TestSession(1).state;
    expect(applyCommand(state, { type: 'buyUpgrade', upgrade: 'betterKeyboard' }).accepted).toBe(false);
  });
});
