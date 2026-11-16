import { isImplementationComplete, isUnfinished } from './cards.ts';
import { isAiTickSpeedMaxedAt, isRepeatableUpgrade, taskReward, upgradeCost } from './economy.ts';
import type { GameEvent } from './events.ts';
import { activeTasksCount } from './counts.ts';
import { upgradeIds, type Rules } from './rules.ts';
import { columnIds, timerIds, type CardId, type GameState } from './state.ts';
import { timerHasWork, timerIntervalUs } from './timers.ts';

/** Invariants of a single state (docs/v0.1/technical-design.md, section 4). Returns human-readable violations. */
export function findInvariantViolations(state: GameState, rules: Rules): string[] {
  const violations: string[] = [];
  const report = (message: string) => violations.push(message);

  const placed = new Map<CardId, number>();
  for (const column of columnIds) {
    for (const id of state.columns[column]) placed.set(id, (placed.get(id) ?? 0) + 1);
  }
  for (const [id, count] of placed) {
    if (count !== 1) report(`card ${id} is placed ${count} times`);
    if (!state.cards[id]) report(`card ${id} is in a column but not in the card dictionary`);
  }

  for (const card of Object.values(state.cards)) {
    const id = card.number;
    if (!placed.has(id)) report(`card ${id} is in no column`);
    if (id < 1 || id >= state.nextCardNumber) report(`card ${id} has a number outside 1..${state.nextCardNumber - 1}`);
    if (card.implementationDone < 0 || card.implementationDone > card.originalComplexity) {
      report(`card ${id} implementation ${card.implementationDone}/${card.originalComplexity}`);
    }
    if (card.reworkDone < 0 || card.reworkDone > card.reworkRequired) {
      report(`card ${id} rework ${card.reworkDone}/${card.reworkRequired}`);
    }
    if (card.reworkRequired > 0 && !isImplementationComplete(card)) report(`card ${id} has rework before implementation`);
    if ((card.returnCount > 0) !== (card.reworkRequired > 0)) report(`card ${id} rework does not match its returns`);

    const inReview = state.columns.review.includes(id);
    const inDone = state.columns.done.includes(id);
    if (inReview && card.review.status === 'none') report(`card ${id} is in Code Review without a review`);
    if (!inReview && card.review.status !== 'none') report(`card ${id} has a review outside Code Review`);
    if (card.review.status === 'running' && !(card.review.elapsedUs >= 0 && card.review.elapsedUs < rules.review.durationUs)) {
      report(`card ${id} review elapsed ${card.review.elapsedUs}`);
    }
    if ((inReview || inDone) && isUnfinished(card)) report(`card ${id} left In Progress with unfinished work`);
    if (inDone !== (card.doneAtUs !== null)) report(`card ${id} completion time does not match its column`);
  }

  const doneTimes = state.columns.done.map((id) => state.cards[id]?.doneAtUs ?? 0);
  if (doneTimes.some((time, index) => index > 0 && time > (doneTimes[index - 1] ?? 0))) {
    report('Done is not ordered newest first');
  }
  if (state.columns.done.length > rules.done.maxCards) report(`Done holds ${state.columns.done.length} cards`);
  if (state.economy.completedTasks < state.columns.done.length) report('fewer completed tasks than cards in Done');

  if (!Number.isSafeInteger(state.economy.credits) || state.economy.credits < 0) {
    report(`credits ${state.economy.credits}`);
  }

  if (activeTasksCount(state) > rules.spawner.boardLimit) report(`active tasks ${activeTasksCount(state)}`);
  const freshToDo = state.columns.todo.filter((id) => state.cards[id]?.returnCount === 0).length;
  if (freshToDo > rules.spawner.toDoLimit) report(`To Do holds ${freshToDo} never-returned cards`);

  for (const id of timerIds) {
    const timer = state.timers[id];
    if (timer.active !== timerHasWork(state, rules, id)) report(`timer ${id} active=${timer.active} without matching work`);
    if (!timer.active && timer.elapsedUs !== 0) report(`stopped timer ${id} keeps ${timer.elapsedUs} µs`);
    if (timer.active && !(timer.elapsedUs >= 0 && timer.elapsedUs < timerIntervalUs(state, rules, id))) {
      report(`timer ${id} elapsed ${timer.elapsedUs}`);
    }
  }

  const { revealed } = state.scenario;
  if (revealed.done && !revealed.codeReview) report('Done revealed before Code Review');
  if (revealed.balance !== state.economy.completedTasks > 0) report('balance visibility does not match payouts');
  if (revealed.shop !== state.scenario.spawnerEnabled) report('shop and generator are out of step');
  if (state.upgrades.levels.aiTickSpeed > 0 && isAiTickSpeedMaxedAt(rules, state.upgrades.levels.aiTickSpeed - 1)) {
    report('AI Tick Speed was bought past its minimum interval');
  }

  return violations;
}

/** Invariants that relate a state to the one before it and to the events between them. */
export function findTransitionViolations(
  rules: Rules,
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
): string[] {
  const violations: string[] = [];
  const report = (message: string) => violations.push(message);

  if (after.timeUs < before.timeUs) report('time went backwards');
  if (after.nextCardNumber < before.nextCardNumber) report('card numbering went backwards');

  let earned = 0;
  let spent = 0;
  let completions = 0;
  const removedFromDone = new Set<CardId>();
  const created = new Set<CardId>();
  for (const event of events) {
    switch (event.type) {
      case 'taskCompleted': {
        completions += 1;
        earned += event.reward;
        if (before.columns.done.includes(event.card)) report(`card ${event.card} was paid twice`);
        const card = after.cards[event.card] ?? before.cards[event.card];
        if (card && event.reward !== taskReward(rules, card.originalComplexity)) report(`card ${event.card} reward ${event.reward}`);
        break;
      }
      case 'upgradePurchased':
        spent += event.cost;
        break;
      case 'doneCardRemoved':
        removedFromDone.add(event.card);
        break;
      case 'cardCreated':
        created.add(event.card);
        if (event.card < before.nextCardNumber) report(`card ${event.card} reused a number`);
        break;
      default:
        break;
    }
  }

  if (after.economy.credits - before.economy.credits !== earned - spent) {
    report(`credits changed by ${after.economy.credits - before.economy.credits}, events say ${earned - spent}`);
  }
  if (after.economy.completedTasks - before.economy.completedTasks !== completions) {
    report('completed-task counter does not match completions');
  }
  for (const id of before.columns.done) {
    if (!after.columns.done.includes(id) && !removedFromDone.has(id)) report(`card ${id} left Done`);
  }
  for (const id of Object.keys(after.cards).map(Number)) {
    if (!before.cards[id] && !created.has(id)) report(`card ${id} appeared without being created`);
  }
  for (const id of upgradeIds) {
    if (before.upgrades.discovered[id] && !after.upgrades.discovered[id]) report(`discovery of ${id} was lost`);
  }
  for (const event of events) {
    if (event.type !== 'upgradePurchased') continue;
    const levelBefore = isRepeatableUpgrade(event.upgrade) ? before.upgrades.levels[event.upgrade] : 0;
    if (event.cost !== upgradeCost(rules, event.upgrade, levelBefore)) report(`${event.upgrade} charged ${event.cost}`);
  }

  return violations;
}
