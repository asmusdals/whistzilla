import { assertValidDeck, type Card } from './cards';
import type { RandomSource } from './random';

export function shuffleDeck(
  deck: readonly Card[],
  random: RandomSource,
): readonly Card[] {
  assertValidDeck(deck);

  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = random.next();

    if (randomValue < 0 || randomValue >= 1 || !Number.isFinite(randomValue)) {
      throw new RangeError(
        'RandomSource.next() must return a finite value in [0, 1).',
      );
    }

    const swapIndex = Math.floor(randomValue * (index + 1));
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];

    if (!current || !replacement) {
      throw new Error('Shuffle index was outside the deck.');
    }

    shuffled[index] = replacement;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}
