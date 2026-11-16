import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { repeatableUpgradeIds, type OneTimeUpgradeId, type RepeatableUpgradeId, type Rules } from '../../core/rules.ts';
import { columnIds, timerIds } from '../../core/state.ts';
import {
  purchaseStrategies,
  simulate,
  type IdleShares,
  type Milestone,
  type PlayerModel,
  type PurchaseStrategy,
  type SimulationResult,
} from '../balanceSimulation.ts';
import { balanceVariants, isBalanceVariantId, type BalanceVariantId } from '../balanceVariants.ts';

const SEEDS = 20;
const LIMIT_MINUTES = 60;
const SEGMENT_MINUTES = 5;
const FINAL_WINDOW_MINUTES = 10;
const OBSERVE_AFTER_FULL_MINUTES = 5;
/** The touchpad player matched with the author in the v0.1 playtest. */
const player: PlayerModel = { clicksPerSecond: 4, dragSeconds: 2, purchaseSeconds: 3 };
const outputPath = new URL('../../../docs/v0.2/balance-simulation.md', import.meta.url);

function requestedVariants(args: readonly string[]): BalanceVariantId[] {
  if (args.length === 0) return ['approved'];
  const unknown = args.filter((arg) => !isBalanceVariantId(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown balance variants: ${unknown.join(', ')}. Known: ${Object.keys(balanceVariants).join(', ')}`);
  }
  return args.filter(isBalanceVariantId);
}

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return (sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower);
}

function formatTime(seconds: number): string {
  if (Number.isNaN(seconds)) return '—';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
const formatNumber = (value: number, digits = 0) => (Number.isNaN(value) ? '—' : value.toFixed(digits));
const formatPercent = (value: number) => `${formatNumber(value * 100)}%`;

function spread(values: readonly number[], format: (value: number) => string): string {
  if (values.length === 0) return '—';
  return `${format(quantile(values, 0.5))} (${format(quantile(values, 0.1))}–${format(quantile(values, 0.9))})`;
}

function milestoneRow(label: string, milestones: readonly (Milestone | null | undefined)[], runs: number): string {
  const reached = milestones.filter((value): value is Milestone => value != null);
  return `| ${label} | ${reached.length}/${runs} | ${spread(reached.map((m) => m.seconds), formatTime)} | ${spread(
    reached.map((m) => m.clicks),
    (v) => formatNumber(v),
  )} | ${spread(reached.map((m) => m.drags), (v) => formatNumber(v))} |`;
}

function idleRows(shares: readonly IdleShares[]): string[] {
  return timerIds.map((id) => {
    const owned = shares.flatMap((share) => {
      const value = share[id];
      return value === null ? [] : [value];
    });
    return `| Доля простоя таймера ${id} | ${owned.length}/${shares.length} | ${spread(owned, formatPercent)} |`;
  });
}

const strategyTitles: Record<PurchaseStrategy, string> = {
  automationFirst: 'Сначала автоматизация (AI Developer → Auto Assign → Auto Submit → Auto Complete, затем самое дешёвое)',
  keyboardFirst: 'Сначала два уровня Better Keyboard, затем автоматизация',
  cheapestFirst: 'Всегда самое дешёвое доступное улучшение',
};

const automationLabels: Record<OneTimeUpgradeId, string> = {
  aiDeveloper: 'AI Developer',
  autoAssign: 'Auto Assign',
  autoSubmit: 'Auto Submit',
  autoComplete: 'Auto Complete',
};

const upgradeLabels: Record<RepeatableUpgradeId, string> = {
  betterKeyboard: 'Better Keyboard',
  aiWorkPower: 'AI Work Power',
  aiTickSpeed: 'AI Tick Speed',
  parallelProcessing: 'Parallel Processing',
  fasterBacklog: 'Faster Backlog',
  biggerTasks: 'Bigger Tasks',
};

function strategySection(strategy: PurchaseStrategy, results: readonly SimulationResult[]): string {
  const runs = results.length;
  const lines = [`#### ${strategyTitles[strategy]}`, ''];
  const firstUpgrades = new Map<string, number>();
  for (const result of results) {
    const name = result.firstPurchase?.upgrade ?? '—';
    firstUpgrades.set(name, (firstUpgrades.get(name) ?? 0) + 1);
  }
  lines.push(
    `Первая покупка: ${[...firstUpgrades].map(([name, count]) => `${name} — ${count} из ${runs}`).join(', ')}.`,
    '',
    '| Момент | Достигнут | Время, мин:с | Клики `Work` | Ручные переносы |',
    '| --- | ---: | ---: | ---: | ---: |',
    milestoneRow('Первая покупка', results.map((r) => r.firstPurchase), runs),
    ...(Object.keys(automationLabels) as OneTimeUpgradeId[]).map((id) =>
      milestoneRow(automationLabels[id], results.map((r) => r.automations[id]), runs),
    ),
    milestoneRow('Полный автоматический цикл (все четыре)', results.map((r) => r.fullAutomation), runs),
    '',
  );

  const after = results.flatMap((r) => (r.afterFullAutomation ? [r.afterFullAutomation] : []));
  if (after.length > 0) {
    lines.push(
      `Первые ${OBSERVE_AFTER_FULL_MINUTES} минут после полного автоматического цикла (игрок продолжает кликать и покупать по стратегии):`,
      '',
      '| Величина | Прогонов | Медиана (10–90%) |',
      '| --- | ---: | ---: |',
      ...columnIds.map(
        (id) => `| Карточек в ${id} | ${after.length}/${runs} | ${spread(after.map((a) => a.columnLoad[id]), (v) => formatNumber(v, 1))} |`,
      ),
      ...idleRows(after.map((a) => a.timerIdleShare)),
      `| Завершённых задач в минуту | ${after.length}/${runs} | ${spread(after.map((a) => a.tasksPerMinute), (v) => formatNumber(v, 1))} |`,
      '',
    );
  }

  const segmentCount = Math.max(...results.map((r) => r.segments.length));
  lines.push(
    `По ${SEGMENT_MINUTES}-минутным отрезкам:`,
    '',
    '| Отрезок, мин | Доход, Credits в минуту | Задач в минуту | Покупок за отрезок |',
    '| --- | ---: | ---: | ---: |',
    ...Array.from({ length: segmentCount }, (_, index) => {
      const segments = results.flatMap((r) => {
        const segment = r.segments[index];
        return segment ? [segment] : [];
      });
      const from = index * SEGMENT_MINUTES;
      return `| ${from}–${from + SEGMENT_MINUTES} | ${spread(segments.map((s) => s.creditsPerMinute), (v) => formatNumber(v))} | ${spread(
        segments.map((s) => s.tasksPerMinute),
        (v) => formatNumber(v, 1),
      )} | ${spread(segments.map((s) => s.purchases), (v) => formatNumber(v))} |`;
    }),
    '',
    `В конце (${LIMIT_MINUTES}-я минута):`,
    '',
    '| Величина | Медиана (10–90%) |',
    '| --- | ---: |',
    ...repeatableUpgradeIds.map(
      (id) => `| Уровень ${upgradeLabels[id]} | ${spread(results.map((r) => r.finalLevels[id]), (v) => formatNumber(v))} |`,
    ),
    `| Заработано всего, Credits | ${spread(results.map((r) => r.totalEarned), (v) => formatNumber(v))} |`,
    `| Не потрачено, Credits | ${spread(results.map((r) => r.finalCredits), (v) => formatNumber(v))} |`,
    '',
    `Последние ${FINAL_WINDOW_MINUTES} минут (только прогоны, где автоматизация была куплена на всё окно):`,
    '',
    '| Величина | Прогонов | Медиана (10–90%) |',
    '| --- | ---: | ---: |',
    ...idleRows(results.map((r) => r.finalIdleShare)),
    '',
  );
  return lines.join('\n');
}

function rulesSummary(rules: Rules): string {
  const s = (us: number) => `${us / 1_000_000} с`;
  const growth = (id: RepeatableUpgradeId) => {
    const { numerator, denominator } = rules.upgrades[id].costGrowth;
    return `${upgradeLabels[id]} ${rules.upgrades[id].baseCost} ×${formatNumber(numerator / denominator, 2)}`;
  };
  return [
    `награда ×${rules.rewardMultiplier}, сложность ${rules.regularTaskComplexity.min}–${rules.regularTaskComplexity.max}`,
    `Review ${s(rules.review.durationUs)}, возврат ${formatPercent(rules.review.returnProbability.numerator / rules.review.returnProbability.denominator)}`,
    `генератор ${s(rules.spawner.intervalUs)} (минимум ${s(rules.spawner.minIntervalUs)}), лимиты ${rules.spawner.toDoLimit} / ${rules.spawner.boardLimit}`,
    `AI ${rules.ai.baseWorkPower} за тик ${s(rules.ai.baseTickIntervalUs)}`,
    `одноразовые: AI Developer ${rules.upgrades.aiDeveloper.baseCost}, Auto Assign ${rules.upgrades.autoAssign.baseCost}, Auto Submit ${rules.upgrades.autoSubmit.baseCost}, Auto Complete ${rules.upgrades.autoComplete.baseCost}`,
    `повторяемые: ${repeatableUpgradeIds.map(growth).join(', ')}`,
  ].join('; ');
}

const variantIds = requestedVariants(process.argv.slice(2));
const sections = variantIds.map((variantId, index) => {
  const variant = balanceVariants[variantId];
  const strategies = purchaseStrategies.map((strategy) => {
    const results = Array.from({ length: SEEDS }, (_, seed) =>
      simulate({
        rules: variant.rules,
        seed: seed + 1,
        strategy,
        player,
        limitSeconds: LIMIT_MINUTES * 60,
        observeSecondsAfterFullAutomation: OBSERVE_AFTER_FULL_MINUTES * 60,
        segmentSeconds: SEGMENT_MINUTES * 60,
        finalWindowSeconds: FINAL_WINDOW_MINUTES * 60,
      }),
    );
    console.log(`${variantId}: ${strategy} done`);
    return strategySection(strategy, results);
  });
  return [`## ${index + 1}. ${variant.title}`, '', `Набор \`${variantId}\`: ${rulesSummary(variant.rules)}.`, '', ...strategies].join('\n');
});

const report = `# Балансовая симуляция Prototype v0.2

Сгенерировано командой \`npm run sim -- ${variantIds.join(' ')}\` (\`src/dev/node/run-balance-sim.ts\`; наборы правил — в \`src/dev/balanceVariants.ts\`). Это материал к игровому тесту v0.2, а не проверка «прошёл / не прошёл»: симуляция **не заменяет** игровое тестирование и баланс не меняет.

## Модель игрока

«Тачпадная» модель, сверенная с автором в игровом тесте v0.1: бот делает одно действие за раз — клик \`Work\` ${formatNumber(1 / player.clicksPerSecond, 2)} с (${player.clicksPerSecond} клика в секунду), ручной перенос карточки ${player.dragSeconds} с, покупка ${player.purchaseSeconds} с. Приоритет: покупка по стратегии, затем ручные переносы с конца конвейера (Done, Code Review, взятие задачи, если в In Progress нет незавершённой), затем клик \`Work\` по верхней незавершённой карточке. После покупки автоматизации соответствующий перенос бот вручную больше не делает; кликать продолжает и после AI Developer. Повторяемые улучшения, включая Faster Backlog и Bigger Tasks, бот покупает по общему правилу стратегии.

${SEEDS} seed на стратегию, каждый прогон — ${LIMIT_MINUTES} минут игрового времени. В таблицах — медиана и в скобках 10-й и 90-й процентили.

${sections.join('\n')}
## Как читать

- «Время» — игровое время от начала сеанса; скрытая вкладка и паузы человека не учтены.
- «Доля простоя таймера» — доля времени, когда таймер выключен из-за отсутствия работы. Для автоматизации это признак избытка мощности или узкого места выше по конвейеру; для генератора — что упёрлись лимиты доски. Считается только по прогонам, где автоматизация куплена на всё окно; их число — в столбце «Прогонов».
- «Доход» — заработанные Credits за отрезок, без вычета трат.
- Модель игрока условная: настоящий человек тратит время на чтение, прицеливание и раздумья, поэтому реальное прохождение будет дольше.
`;

writeFileSync(outputPath, report);
console.log(`Balance simulation written to ${fileURLToPath(outputPath)}`);
