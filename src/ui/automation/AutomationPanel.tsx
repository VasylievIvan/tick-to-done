import { useTranslation } from 'react-i18next';
import { aiTickIntervalUs, aiWorkPower, parallelTasks, timerProgress } from '../../core/selectors.ts';
import { MICROSECONDS_PER_SECOND } from '../../core/rules.ts';
import type { TimerId } from '../../core/state.ts';
import { useGame, useGameList } from '../GameContext.tsx';
import panel from '../Panel.module.css';
import styles from './Automation.module.css';
import { TimerRing } from './TimerRing.tsx';

type AutomationId = Exclude<TimerId, 'spawner'>;

/** Pipeline order: what feeds In Progress, what works there, then what moves the results on. */
const automationOrder: readonly AutomationId[] = ['autoAssign', 'aiDeveloper', 'autoSubmit', 'autoComplete'];

function AiDetails() {
  const { t } = useTranslation();
  const power = useGame(aiWorkPower);
  const tickUs = useGame(aiTickIntervalUs);
  const slots = useGame(parallelTasks);
  return <>{t('automation.aiStats', { power, tick: tickUs / MICROSECONDS_PER_SECOND, slots })}</>;
}

function AutomationRow({ id }: { id: AutomationId }) {
  const { t } = useTranslation();
  const progress = useGame((game, rules) => timerProgress(game, rules, id));
  const active = useGame((game) => game.timers[id].active);
  const name = t(`shop.upgrade.${id}.name`);
  return (
    <li className={styles.row} data-automation={id}>
      <TimerRing progress={progress} active={active} label={t('automation.timer', { name })} />
      <span className={styles.name}>{name}</span>
      <span className={styles.status}>{active ? t('automation.working') : t('automation.idle')}</span>
      <span className={styles.details}>{id === 'aiDeveloper' ? <AiDetails /> : t(`shop.upgrade.${id}.effect`)}</span>
    </li>
  );
}

export function AutomationPanel() {
  const { t } = useTranslation();
  const rows = useGameList((game) => automationOrder.filter((id) => game.upgrades.owned[id]));
  if (rows.length === 0) return null;
  return (
    <section className={panel.panel} aria-label={t('automation.title')}>
      <h2 className={panel.title}>{t('automation.title')}</h2>
      <ul className={panel.list}>
        {rows.map((id) => (
          <AutomationRow key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}
