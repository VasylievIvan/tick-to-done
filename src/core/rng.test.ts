import { describe, expect, it } from 'vitest';
import { balance } from '../config/balance.ts';
import {
  ceilScaledByUniformFactor,
  createRngState,
  drawUint32,
  isBelowProbability,
  stepUint32,
  uniformIntInclusive,
  type RngStream,
} from './rng.ts';

const UINT32_MAX = 2 ** 32 - 1;

function drawSequence(seed: number, stream: RngStream, count: number): number[] {
  const rng = { ...createRngState(seed) };
  return Array.from({ length: count }, () => drawUint32(rng, stream));
}

describe('seeded generator', () => {
  it('gives the same sequence for the same seed', () => {
    expect(drawSequence(42, 'generation', 50)).toEqual(drawSequence(42, 'generation', 50));
    expect(createRngState(42)).toEqual(createRngState(42));
  });

  it('gives different sequences for different seeds', () => {
    expect(drawSequence(42, 'generation', 10)).not.toEqual(drawSequence(43, 'generation', 10));
  });

  it('keeps the streams independent', () => {
    const rng = { ...createRngState(7) };
    const reviewBefore = rng.review;
    const reworkBefore = rng.rework;
    drawUint32(rng, 'generation');
    drawUint32(rng, 'generation');
    expect(rng.review).toBe(reviewBefore);
    expect(rng.rework).toBe(reworkBefore);
    expect(drawSequence(7, 'review', 5)).not.toEqual(drawSequence(7, 'rework', 5));
  });

  it('produces unsigned 32-bit integers', () => {
    let state = 123;
    for (let i = 0; i < 1000; i += 1) {
      const { value, next } = stepUint32(state);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(UINT32_MAX);
      state = next;
    }
  });
});

describe('distributions', () => {
  it('draws regular task complexity as a uniform integer from 10 to 30 inclusive', () => {
    const { min, max } = balance.regularTaskComplexity;
    expect(uniformIntInclusive(0, min, max)).toBe(10);
    expect(uniformIntInclusive(UINT32_MAX, min, max)).toBe(30);
    const seen = new Set(drawSequence(1, 'generation', 5000).map((draw) => uniformIntInclusive(draw, min, max)));
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => 10 + i));
  });

  it('returns about 15% of reviews', () => {
    const draws = drawSequence(3, 'review', 20_000);
    const returned = draws.filter((draw) => isBelowProbability(draw, balance.review.returnProbability)).length;
    expect(returned / draws.length).toBeGreaterThan(0.14);
    expect(returned / draws.length).toBeLessThan(0.16);
    expect(isBelowProbability(0, balance.review.returnProbability)).toBe(true);
    expect(isBelowProbability(UINT32_MAX, balance.review.returnProbability)).toBe(false);
  });

  it('computes Rework = ceil(OriginalComplexity × factor) with factor in [0.2, 0.4)', () => {
    const range = balance.review.reworkFactor;
    expect(ceilScaledByUniformFactor(0, 20, range)).toBe(4);
    expect(ceilScaledByUniformFactor(UINT32_MAX, 20, range)).toBe(8);
    expect(ceilScaledByUniformFactor(0, 10, range)).toBe(2);
    expect(ceilScaledByUniformFactor(UINT32_MAX, 10, range)).toBe(4);
    // The middle draw gives factor 0.3 exactly; in floating point 0.2 + 0.1 = 0.30000000000000004 and 10 × it rounds up to 4.
    expect(ceilScaledByUniformFactor(2 ** 31, 10, range)).toBe(3);
    expect(ceilScaledByUniformFactor(2 ** 31 + 1, 10, range)).toBe(4);
  });

  it('keeps the third scripted task rework within 4–8 units for any draw', () => {
    const amounts = new Set(
      drawSequence(9, 'rework', 5000).map((draw) => ceilScaledByUniformFactor(draw, 20, balance.review.reworkFactor)),
    );
    expect([...amounts].sort((a, b) => a - b)).toEqual([5, 6, 7, 8]);
  });
});
