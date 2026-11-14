import styles from './ProgressBar.module.css';

export type ProgressTone = 'implementation' | 'rework' | 'review';

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  tone: ProgressTone;
}

export function ProgressBar({ label, value, max, tone }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={styles.progress}>
      <div className={styles.label}>{label}</div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className={[styles.fill, styles[tone]].join(' ')} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
