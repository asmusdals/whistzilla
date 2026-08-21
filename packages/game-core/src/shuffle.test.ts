import { describe, expect, it } from 'vitest';

import { createDeck } from './cards';
import { createSeededRandom } from './random';
import { shuffleDeck } from './shuffle';

describe('shuffleDeck', () => {
  it('is reproducible for a seed and does not mutate its input', () => {
    const deck = createDeck();
    const originalOrder = deck.map(({ id }) => id);
    const first = shuffleDeck(deck, createSeededRandom(42));
    const second = shuffleDeck(deck, createSeededRandom(42));

    expect(first.map(({ id }) => id)).toEqual(second.map(({ id }) => id));
    expect(deck.map(({ id }) => id)).toEqual(originalOrder);
    expect(first.map(({ id }) => id)).not.toEqual(originalOrder);
  });

  it('rejects random values outside the required interval', () => {
    expect(() => shuffleDeck(createDeck(), { next: () => 1 })).toThrow(
      RangeError,
    );
  });
});
