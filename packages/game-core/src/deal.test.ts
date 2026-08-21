import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createDeck, InvalidDeckError } from './cards';
import { createSeededDeal, dealDeck, SEATS, type Seat } from './deal';

describe('dealDeck', () => {
  it('deals clockwise from the seat left of the dealer', () => {
    const deck = createDeck();
    const deal = dealDeck(deck, 3);

    expect(deal.firstRecipient).toBe(0);
    expect(deal.hands[0][0]).toBe(deck[0]);
    expect(deal.hands[1][0]).toBe(deck[1]);
    expect(deal.hands[2][0]).toBe(deck[2]);
    expect(deal.hands[3][0]).toBe(deck[3]);
  });

  it('rejects an invalid deck', () => {
    expect(() => dealDeck(createDeck().slice(1), 0)).toThrow(InvalidDeckError);
  });

  it('reproduces a deal from its seed', () => {
    expect(createSeededDeal(2026, 1)).toEqual(createSeededDeal(2026, 1));
  });

  it('conserves all 55 cards for every seed and dealer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffff_ffff }),
        fc.integer({ min: 0, max: 3 }),
        (seed, dealer) => {
          const deal = createSeededDeal(seed, dealer as Seat);
          const dealtCards = [...deal.hands.flat(), ...deal.kitty];

          expect(deal.hands.map((hand) => hand.length)).toEqual([
            13, 13, 13, 13,
          ]);
          expect(deal.kitty).toHaveLength(3);
          expect(dealtCards).toHaveLength(55);
          expect(new Set(dealtCards.map(({ id }) => id)).size).toBe(55);
          expect(SEATS).toContain(deal.firstRecipient);
        },
      ),
    );
  });
});
