import { technical } from '../config/technical.ts';

export interface FrameSource {
  readonly request: (callback: (timestampMs: number) => void) => number;
  readonly cancel: (handle: number) => void;
}

export interface VisibilitySource {
  readonly isHidden: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

export interface DriverOptions {
  readonly advance: (deltaUs: number) => void;
  frames: FrameSource;
  visibility: VisibilitySource;
  /** Game-time multiplier; only the development build sets it above 1. */
  speed?: number;
}

/**
 * Feeds real time into the game once per animation frame. A frame never passes more than the technical limit, and
 * a hidden tab gets no frames, so the game pauses and resumes from the same point without catching up.
 */
export function startTimeDriver({ advance, frames, visibility, speed = 1 }: DriverOptions): () => void {
  let lastMs: number | null = null;
  let handle = frames.request(onFrame);

  function onFrame(timestampMs: number) {
    if (lastMs !== null && !visibility.isHidden()) {
      const realUs = Math.round((timestampMs - lastMs) * 1000);
      const clampedUs = Math.min(Math.max(realUs, 0), technical.maxFrameDeltaUs);
      advance(Math.round(clampedUs * speed));
    }
    lastMs = timestampMs;
    handle = frames.request(onFrame);
  }

  const unsubscribe = visibility.subscribe(() => {
    lastMs = null;
  });

  return () => {
    frames.cancel(handle);
    unsubscribe();
  };
}

export const browserFrames: FrameSource = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => {
    window.cancelAnimationFrame(handle);
  },
};

export const browserVisibility: VisibilitySource = {
  isHidden: () => document.visibilityState === 'hidden',
  subscribe: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  },
};
