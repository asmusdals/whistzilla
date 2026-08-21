export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'jack',
  'queen',
  'king',
  'ace',
] as const;
export type Rank = (typeof RANKS)[number];

export const JOKER_NUMBERS = [1, 2, 3] as const;
export type JokerNumber = (typeof JOKER_NUMBERS)[number];

export type SuitedCardId = `${Suit}:${Rank}`;
export type JokerCardId = `joker:${JokerNumber}`;
export type CardId = SuitedCardId | JokerCardId;

export interface SuitedCard {
  readonly kind: 'suited';
  readonly id: SuitedCardId;
  readonly suit: Suit;
  readonly rank: Rank;
}

export interface JokerCard {
  readonly kind: 'joker';
  readonly id: JokerCardId;
  readonly number: JokerNumber;
}

export type Card = SuitedCard | JokerCard;

function createSuitedCard(suit: Suit, rank: Rank): SuitedCard {
  return Object.freeze({
    kind: 'suited',
    id: `${suit}:${rank}`,
    suit,
    rank,
  });
}

function createJoker(number: JokerNumber): JokerCard {
  return Object.freeze({
    kind: 'joker',
    id: `joker:${number}`,
    number,
  });
}

const STANDARD_CARDS = SUITS.flatMap((suit) =>
  RANKS.map((rank) => createSuitedCard(suit, rank)),
);

const JOKERS = JOKER_NUMBERS.map(createJoker);

const WHIST_DECK = Object.freeze([...STANDARD_CARDS, ...JOKERS]);
const EXPECTED_CARD_IDS = new Set(WHIST_DECK.map(({ id }) => id));

export function createDeck(): readonly Card[] {
  return [...WHIST_DECK];
}

export type DeckValidationIssue =
  | {
      readonly code: 'wrong-card-count';
      readonly actual: number;
      readonly expected: 55;
    }
  | { readonly code: 'duplicate-card'; readonly cardId: CardId }
  | { readonly code: 'unexpected-card'; readonly cardId: CardId }
  | { readonly code: 'missing-card'; readonly cardId: CardId };

export function validateDeck(
  deck: readonly Card[],
): readonly DeckValidationIssue[] {
  const issues: DeckValidationIssue[] = [];
  const seen = new Set<CardId>();

  if (deck.length !== WHIST_DECK.length) {
    issues.push({
      code: 'wrong-card-count',
      actual: deck.length,
      expected: 55,
    });
  }

  for (const card of deck) {
    if (!EXPECTED_CARD_IDS.has(card.id)) {
      issues.push({ code: 'unexpected-card', cardId: card.id });
    }

    if (seen.has(card.id)) {
      issues.push({ code: 'duplicate-card', cardId: card.id });
    }

    seen.add(card.id);
  }

  for (const expectedId of EXPECTED_CARD_IDS) {
    if (!seen.has(expectedId)) {
      issues.push({ code: 'missing-card', cardId: expectedId });
    }
  }

  return issues;
}

export class InvalidDeckError extends Error {
  readonly issues: readonly DeckValidationIssue[];

  constructor(issues: readonly DeckValidationIssue[]) {
    super('The deck is not a complete Whistzilla deck.');
    this.name = 'InvalidDeckError';
    this.issues = issues;
  }
}

export function assertValidDeck(deck: readonly Card[]): void {
  const issues = validateDeck(deck);

  if (issues.length > 0) {
    throw new InvalidDeckError(issues);
  }
}
