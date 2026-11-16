import { useTranslation } from 'react-i18next';
import { aiTickIntervalUs, aiWorkPower, parallelTasks, timerProgress } from '../../core/selectors.ts';
import { MICROSECONDS_PER_SECOND } from '../../core/rules.ts';
import { useGame } from '../GameContext.tsx';
import panel from '../Panel.module.css';
import styles from './Automation.module.css';
import { TimerRing } from './TimerRing.tsx';

function AiDetails() {
  const { t } = useTranslation();
  const power = useGame(aiWorkPower);
  const tickUs = useGame(aiTickIntervalUs);
  const slots = useGame(parallelTasks);
  return (
    <>
      <div>{t('automation.aiPower', { power })}</div>
      <div>{t('automation.aiTick', { tick: tickUs / MICROSECONDS_PER_SECOND })}</div>
      <div>{t('automation.aiSlots', { slots })}</div>
    </>
  );
}

/** The card moves are timed in the headers of the columns they take cards from; only the AI tick stays here. */
function AiDeveloperRow() {
  const { t } = useTranslation();
  const progress = useGame((game, rules) => timerProgress(game, rules, 'aiDeveloper'));
  const active = useGame((game) => game.timers.aiDeveloper.active);
  const name = t('shop.upgrade.aiDeveloper.name');
  return (
    <li className={styles.row} data-automation="aiDeveloper">
      <TimerRing progress={progress} active={active} label={t('automation.timer', { name })} />
      <span className={styles.name}>{name}</span>
      <span className={styles.status}>{active ? t('automation.working') : t('automation.idle')}</span>
      <span className={styles.details}>
        <AiDetails />
      </span>
    </li>
  );
}

export function AutomationPanel() {
  const { t } = useTranslation();
  const owned = useGame((game) => game.upgrades.owned.aiDeveloper);
  if (!owned) return null;
  return (
    <section className={panel.panel} aria-label={t('automation.title')}>
      <h2 className={panel.title}>{t('automation.title')}</h2>
      <ul className={panel.list}>
        <AiDeveloperRow />
      </ul>
    </section>
  );
}
