import { describe, expect, it } from 'vitest';
import { startTimeDriver, type FrameSource, type VisibilitySource } from './driver.ts';

function fakeBrowser() {
  let pending: ((timestampMs: number) => void) | null = null;
  let hidden = false;
  const listeners = new Set<() => void>();
  const frames: FrameSource = {
    request: (callback) => {
      pending = callback;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  const visibility: VisibilitySource = {
    isHidden: () => hidden,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    frames,
    visibility,
    frame(timestampMs: number) {
      const callback = pending;
      pending = null;
      callback?.(timestampMs);
    },
    setHidden(value: boolean) {
      hidden = value;
      for (const listener of listeners) listener();
    },
    get running() {
      return pending !== null;
    },
  };
}

describe('time driver', () => {
  it('passes the real time between frames in whole microseconds', () => {
    const browser = fakeBrowser();
    const deltas: number[] = [];
    startTimeDriver({ advance: (us) => deltas.push(us), frames: browser.frames, visibility: browser.visibility });
    browser.frame(1000);
    browser.frame(1016.7);
    browser.frame(1033.4);
    expect(deltas).toEqual([16_700, 16_700]);
  });

  it('never passes more than 250 ms in one frame', () => {
    const browser = fakeBrowser();
    const deltas: number[] = [];
    startTimeDriver({ advance: (us) => deltas.push(us), frames: browser.frames, visibility: browser.visibility });
    browser.frame(0);
    browser.frame(5000);
    expect(deltas).toEqual([250_000]);
  });

  it('pauses in a hidden tab and resumes from the same point without catching up', () => {
    const browser = fakeBrowser();
    const deltas: number[] = [];
    startTimeDriver({ advance: (us) => deltas.push(us), frames: browser.frames, visibility: browser.visibility });
    browser.frame(0);
    browser.frame(16);
    browser.setHidden(true);
    browser.frame(30_000);
    browser.setHidden(false);
    browser.frame(60_000);
    browser.frame(60_016);
    expect(deltas).toEqual([16_000, 16_000]);
  });

  it('multiplies game time by the development speed', () => {
    const browser = fakeBrowser();
    const deltas: number[] = [];
    startTimeDriver({ advance: (us) => deltas.push(us), frames: browser.frames, visibility: browser.visibility, speed: 4 });
    browser.frame(0);
    browser.frame(10);
    expect(deltas).toEqual([40_000]);
  });

  it('stops requesting frames when stopped', () => {
    const browser = fakeBrowser();
    const stop = startTimeDriver({ advance: () => undefined, frames: browser.frames, visibility: browser.visibility });
    expect(browser.running).toBe(true);
    stop();
    expect(browser.running).toBe(false);
  });
});
