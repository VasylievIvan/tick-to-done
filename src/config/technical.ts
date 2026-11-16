export const technical = {
  /** Upper bound of one real-time frame passed to the engine: the game never catches up on lost time. */
  maxFrameDeltaUs: 250_000,
  journalLimit: 200,
} as const;
