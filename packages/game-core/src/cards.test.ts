import { describe, expect, it } from 'vitest';

import {
  createDeck,
  JOKER_NUMBERS,
  RANKS,
  SUITS,
  validateDeck,
  type SuitedCard,
} from './cards';

describe('Whistzilla deck', () => {
  it('contains 52 suited cards and 3 individually identified jokers', () => {
    const deck = createDeck();
    const suitedCards = deck.filter((card) => card.kind === 'suited');
    const jokers = deck.filter((card) => card.kind === 'joker');

    expect(deck).toHaveLength(55);
    expect(suitedCards).toHaveLength(52);
    expect(jokers.map(({ number }) => number)).toEqual(JOKER_NUMBERS);
    expect(new Set(deck.map(({ id }) => id)).size).toBe(55);
  });

  it.each(SUITS)('contains every rank in %s', (suit) => {
    const ranks = createDeck()
      .filter(
        (card): card is SuitedCard =>
          card.kind === 'suited' && card.suit === suit,
      )
      .map(({ rank }) => rank);

    expect(ranks).toEqual(RANKS);
  });

  it('returns a fresh deck array', () => {
    expect(createDeck()).not.toBe(createDeck());
  });

  it('reports duplicate and missing cards', () => {
    const deck = [...createDeck()];
    const firstCard = deck[0];

    if (!firstCard) {
      throw new Error('Expected a non-empty deck.');
    }

    deck[1] = firstCard;

    expect(validateDeck(deck)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate-card',
          cardId: firstCard.id,
        }),
        expect.objectContaining({ code: 'missing-card' }),
      ]),
    );
  });
});
