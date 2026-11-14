import type { StoreApi } from 'zustand/vanilla';
import type { GameState } from '../src/core/state.ts';

declare global {
  interface Window {
    /** Exposed by the development build only (src/app/session.ts). */
    __vibecode?: { readonly store: StoreApi<{ game: GameState }> };
  }
}
