import type { CSSProperties } from 'react';
import styles from './Automation.module.css';

interface TimerRingProps {
  progress: number;
  label: string;
  active: boolean;
}

/** Radial fill like a clock face: the share of the interval that has passed. */
export function TimerRing({ progress, label, active }: TimerRingProps) {
  const percent = Math.round(progress * 100);
  const style = { '--progress': progress } as CSSProperties;
  return (
    <div
      className={[styles.ring, active ? styles.ringActive : styles.ringIdle].join(' ')}
      style={style}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    />
  );
}
