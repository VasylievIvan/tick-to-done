import { useTranslation } from 'react-i18next';
import { useGame } from '../GameContext.tsx';
import styles from './StatsBar.module.css';

export function StatsBar() {
  const { t } = useTranslation();
  const credits = useGame((game) => game.economy.credits);
  const completed = useGame((game) => game.economy.completedTasks);
  return (
    <div className={styles.stats}>
      <span className={styles.credits} data-testid="credits">
        {t('stats.credits', { value: credits })}
      </span>
      <span className={styles.tasks} data-testid="tasks-done">
        {t('stats.tasksDone', { count: completed })}
      </span>
    </div>
  );
}
