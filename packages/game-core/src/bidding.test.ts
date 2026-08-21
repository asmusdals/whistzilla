import { describe, expect, it } from 'vitest';

import { ALL_BIDS, compareBids, isHigherBid, type Bid } from './bidding';

const numerical = (
  level: 7 | 8 | 9 | 10 | 11 | 12 | 13,
  bidType: 'ordinary' | 'halves' | 'good' | 'vip',
): Bid => ({
  kind: 'numerical',
  level,
  bidType,
});

const special = (
  bidType: 'sol' | 'pure-sol' | 'open-laydown' | 'super-laydown',
): Bid => ({
  kind: 'special',
  bidType,
});

describe('bid hierarchy', () => {
  it('orders numerical types within a level', () => {
    expect(isHigherBid(numerical(9, 'halves'), numerical(9, 'ordinary'))).toBe(
      true,
    );
    expect(isHigherBid(numerical(9, 'good'), numerical(9, 'halves'))).toBe(
      true,
    );
    expect(isHigherBid(numerical(9, 'vip'), numerical(9, 'good'))).toBe(true);
  });

  it('places every higher level above the previous level', () => {
    expect(isHigherBid(numerical(10, 'ordinary'), numerical(9, 'vip'))).toBe(
      true,
    );
  });

  it('places special bids at their stated thresholds', () => {
    expect(isHigherBid(special('sol'), numerical(9, 'halves'))).toBe(true);
    expect(isHigherBid(numerical(9, 'good'), special('sol'))).toBe(true);
    expect(isHigherBid(numerical(10, 'good'), special('pure-sol'))).toBe(true);
    expect(isHigherBid(numerical(11, 'good'), special('open-laydown'))).toBe(
      true,
    );
    expect(isHigherBid(special('super-laydown'), numerical(13, 'vip'))).toBe(
      true,
    );
  });

  it('contains each available contract bid once in sorted order', () => {
    expect(ALL_BIDS).toHaveLength(32);
    expect([...ALL_BIDS].sort(compareBids)).toEqual(ALL_BIDS);
  });
});
