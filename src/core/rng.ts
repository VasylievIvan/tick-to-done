import type { Fraction } from '../config/balance.ts';

/**
 * Independent streams: changing how one kind of value is drawn never shifts the others for the same seed.
 */
export interface RngState {
  readonly generation: number;
  readonly review: number;
  readonly rework: number;
}

export type RngStream = keyof RngState;

const UINT32_RANGE = 2 ** 32;
const UINT32_RANGE_BIG = 2n ** 32n;

const streamSalts: Record<RngStream, number> = {
  generation: 0x9e3779b9,
  review: 0x7f4a7c15,
  rework: 0x632be5ab,
};

function mix32(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

export function createRngState(seed: number): RngState {
  const base = seed >>> 0;
  return {
    generation: mix32(base ^ streamSalts.generation),
    review: mix32(base ^ streamSalts.review),
    rework: mix32(base ^ streamSalts.rework),
  };
}

/** One step of mulberry32: returns a uniform 32-bit unsigned integer and the next stream state. */
export function stepUint32(streamState: number): { readonly value: number; readonly next: number } {
  const next = (streamState + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, next };
}

/** Draws from one stream of a mutable (Immer draft) RNG state. */
export function drawUint32(rng: { -readonly [K in RngStream]: number }, stream: RngStream): number {
  const { value, next } = stepUint32(rng[stream]);
  rng[stream] = next;
  return value;
}

export function uniformIntInclusive(draw: number, min: number, max: number): number {
  return min + Math.floor((draw * (max - min + 1)) / UINT32_RANGE);
}

export function isBelowProbability(draw: number, probability: Fraction): boolean {
  return draw * probability.denominator < probability.numerator * UINT32_RANGE;
}

/**
 * `ceil(amount × factor)` for a factor drawn uniformly from [min, max), computed in exact integers:
 * factor = (A·2³² + draw·(B − A)) / (D·2³²), where A/D and B/D are the bounds over a common denominator.
 */
export function ceilScaledByUniformFactor(
  draw: number,
  amount: number,
  range: { readonly min: Fraction; readonly max: Fraction },
): number {
  const denominator = BigInt(range.min.denominator * range.max.denominator);
  const low = BigInt(range.min.numerator * range.max.denominator);
  const high = BigInt(range.max.numerator * range.min.denominator);
  const factorNumerator = low * UINT32_RANGE_BIG + BigInt(draw) * (high - low);
  const numerator = BigInt(amount) * factorNumerator;
  const divisor = denominator * UINT32_RANGE_BIG;
  return Number((numerator + divisor - 1n) / divisor);
}
