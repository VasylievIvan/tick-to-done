import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { balance, type OneTimeUpgradeId } from '../../config/balance.ts';
import { columnIds, timerIds } from '../../core/state.ts';
import {
  purchaseStrategies,
  simulate,
  type Milestone,
  type PlayerModel,
  type PurchaseStrategy,
  type SimulationResult,
} from '../balanceSimulation.ts';

const SEEDS = 60;
const player: PlayerModel = { clicksPerSecond: 6, dragSeconds: 1.2, purchaseSeconds: 1.5 };
const outputPath = new URL('../../../docs/v0.1/balance-simulation.md', import.meta.url);

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return (sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (position - lower);
}

const formatTime = (seconds: number) =>
  Number.isNaN(seconds) ? '—' : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
const formatNumber = (value: number, digits = 0) => (Number.isNaN(value) ? '—' : value.toFixed(digits));

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

function section(strategy: PurchaseStrategy, results: readonly SimulationResult[]): string {
  const lines = [`### ${strategyTitles[strategy]}`, ''];
  const firstUpgrades = new Map<string, number>();
  for (const result of results) {
    const name = result.firstPurchase?.upgrade ?? '—';
    firstUpgrades.set(name, (firstUpgrades.get(name) ?? 0) + 1);
  }
  lines.push(
    `Первая покупка: ${[...firstUpgrades].map(([name, count]) => `${name} — ${count} из ${results.length}`).join(', ')}.`,
    '',
    '| Момент | Достигнут | Время, мин:с | Клики `Work` | Ручные переносы |',
    '| --- | ---: | ---: | ---: | ---: |',
    milestoneRow('Первая покупка', results.map((r) => r.firstPurchase), results.length),
    ...(Object.keys(automationLabels) as OneTimeUpgradeId[]).map((id) =>
      milestoneRow(automationLabels[id], results.map((r) => r.automations[id]), results.length),
    ),
    milestoneRow('Полный автоматический цикл (все четыре)', results.map((r) => r.fullAutomation), results.length),
    '',
  );

  const after = results.flatMap((r) => (r.afterFullAutomation ? [r.afterFullAutomation] : []));
  if (after.length > 0) {
    lines.push(
      'Первые 5 минут после полного автоматического цикла (игрок продолжает кликать и покупать по стратегии):',
      '',
      `| Величина | Медиана (10–90%) |`,
      '| --- | ---: |',
      ...columnIds.map((id) => `| Карточек в ${id} | ${spread(after.map((a) => a.columnLoad[id]), (v) => formatNumber(v, 1))} |`),
      ...timerIds.map(
        (id) => `| Доля простоя таймера ${id} | ${spread(after.map((a) => a.timerIdleShare[id] * 100), (v) => `${formatNumber(v)}%`)} |`,
      ),
      `| Завершённых задач в минуту | ${spread(after.map((a) => a.tasksPerMinute), (v) => formatNumber(v, 1))} |`,
      '',
    );
  }
  return lines.join('\n');
}

const sections = purchaseStrategies.map((strategy) => {
  const results = Array.from({ length: SEEDS }, (_, index) =>
    simulate({ seed: index + 1, strategy, player, limitSeconds: 90 * 60, observeSecondsAfterFullAutomation: 5 * 60 }),
  );
  return section(strategy, results);
});

const report = `# Балансовая симуляция Prototype v0.1

Сгенерировано командой \`npm run sim\` (\`src/dev/node/run-balance-sim.ts\`). Это материал к открытым вопросам о темпе, а не проверка «прошёл / не прошёл»: по правилам проекта симуляция **не заменяет** игровое тестирование и баланс не меняет.

## Модель игрока

Бот делает одно действие за раз, каждое занимает время внимания: клик \`Work\` — ${formatNumber(1 / player.clicksPerSecond, 2)} с (${player.clicksPerSecond} кликов в секунду), ручной перенос карточки — ${player.dragSeconds} с, покупка — ${player.purchaseSeconds} с. Приоритет: покупка по стратегии, затем ручные переносы с конца конвейера (Done, Code Review, взятие задачи, если в In Progress нет незавершённой), затем клик \`Work\` по верхней незавершённой карточке. После покупки автоматизации соответствующий перенос бот вручную больше не делает. Кликать он продолжает и после покупки AI Developer.

Баланс — утверждённый в \`prototype.md\` (Review ${balance.review.durationUs / 1_000_000} с, возврат ${balance.review.returnProbability.numerator}%, генератор ${balance.spawner.intervalUs / 1_000_000} с, лимиты ${balance.spawner.toDoLimit} / ${balance.spawner.boardLimit}). ${SEEDS} seed на стратегию, предел — 90 минут игрового времени. В таблицах — медиана и в скобках 10-й и 90-й процентили.

## Результаты

${sections.join('\n')}
## Как читать

- «Время» — игровое время от начала сеанса; скрытая вкладка и паузы человека не учтены.
- «Доля простоя таймера» — доля времени, когда таймер выключен из-за отсутствия работы (для купленной автоматизации это признак узкого места или избытка мощности).
- Модель игрока условная: настоящий человек тратит время на чтение, прицеливание и раздумья, поэтому реальное прохождение будет дольше.
`;

writeFileSync(outputPath, report);
console.log(`Balance simulation written to ${fileURLToPath(outputPath)}`);
