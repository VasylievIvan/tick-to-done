interface ImportMetaEnv {
  /** `test` builds the game with the fixed test rules instead of the approved balance (browser tests only). */
  readonly VITE_RULES?: 'test';
}

/** The package version, injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string;
