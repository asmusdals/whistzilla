import { assertValidDeck, createDeck, type Card } from './cards';
import { createSeededRandom, type ShuffleSeed } from './random';
import { shuffleDeck } from './shuffle';

export const SEATS = [0, 1, 2, 3] as const;
export type Seat = (typeof SEATS)[number];
export type Hand = readonly Card[];

export interface Deal {
  readonly dealer: Seat;
  readonly firstRecipient: Seat;
  readonly hands: readonly [Hand, Hand, Hand, Hand];
  readonly kitty: readonly Card[];
}

export interface SeededDeal extends Deal {
  readonly seed: ShuffleSeed;
}

function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % SEATS.length) as Seat;
}

export function dealDeck(deck: readonly Card[], dealer: Seat): Deal {
  assertValidDeck(deck);

  if (!SEATS.includes(dealer)) {
    throw new RangeError('Dealer must be one of the four seats.');
  }

  const firstRecipient = nextSeat(dealer);
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];

  for (let index = 0; index < 52; index += 1) {
    const card = deck[index];
    const seat = ((firstRecipient + index) % SEATS.length) as Seat;

    if (!card) {
      throw new Error('The validated deck did not contain enough cards.');
    }

    hands[seat].push(card);
  }

  return {
    dealer,
    firstRecipient,
    hands: hands.map((hand) => Object.freeze([...hand])) as [
      Hand,
      Hand,
      Hand,
      Hand,
    ],
    kitty: Object.freeze(deck.slice(52)),
  };
}

export function createSeededDeal(seed: ShuffleSeed, dealer: Seat): SeededDeal {
  const shuffledDeck = shuffleDeck(createDeck(), createSeededRandom(seed));

  return {
    ...dealDeck(shuffledDeck, dealer),
    seed,
  };
}
