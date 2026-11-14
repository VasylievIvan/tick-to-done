import { useTranslation } from 'react-i18next';
import { MICROSECONDS_PER_SECOND } from '../../config/balance.ts';
import { aiTickIntervalUs, aiWorkPower, parallelTasks, timerProgress } from '../../core/selectors.ts';
import { useGame } from '../GameContext.tsx';
import styles from './Automation.module.css';
import { TimerRing } from './TimerRing.tsx';

function AiDeveloperRow() {
  const { t } = useTranslation();
  const progress = useGame((game) => timerProgress(game, 'aiDeveloper'));
  const active = useGame((game) => game.timers.aiDeveloper.active);
  const power = useGame(aiWorkPower);
  const tickUs = useGame(aiTickIntervalUs);
  const slots = useGame(parallelTasks);
  const name = t('shop.upgrade.aiDeveloper.name');
  return (
    <li className={styles.row} data-automation="aiDeveloper">
      <TimerRing progress={progress} active={active} label={t('automation.timer', { name })} />
      <span className={styles.name}>{name}</span>
      <span className={styles.status}>{active ? t('automation.working') : t('automation.idle')}</span>
      <span className={styles.details}>
        {t('automation.aiStats', { power, tick: tickUs / MICROSECONDS_PER_SECOND, slots })}
      </span>
    </li>
  );
}

export function AutomationPanel() {
  const { t } = useTranslation();
  const aiDeveloper = useGame((game) => game.upgrades.owned.aiDeveloper);
  if (!aiDeveloper) return null;
  return (
    <section className={styles.panel} aria-label={t('automation.title')}>
      <h2 className={styles.title}>{t('automation.title')}</h2>
      <ul className={styles.list}>
        <AiDeveloperRow />
      </ul>
    </section>
  );
}
