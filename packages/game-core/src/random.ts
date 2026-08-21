export interface RandomSource {
  next(): number;
}

export type ShuffleSeed = number;

const UINT32_RANGE = 0x1_0000_0000;

export function createSeededRandom(seed: ShuffleSeed): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError('Shuffle seed must be an unsigned 32-bit integer.');
  }

  let state = seed >>> 0;

  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
    },
  };
}
