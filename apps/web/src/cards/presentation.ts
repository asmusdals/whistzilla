import { RANKS, type Card } from '@whistzilla/game-core';

export const CARD_RANK_LABELS = {
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  jack: 'J',
  queen: 'Q',
  king: 'K',
  ace: 'A',
} as const;

const HAND_SUIT_ORDER = ['hearts', 'diamonds', 'spades', 'clubs'] as const;

export function compareHandCards(left: Card, right: Card): number {
  if (left.kind === 'joker' && right.kind === 'joker') {
    return left.number - right.number;
  }
  if (left.kind === 'joker') return 1;
  if (right.kind === 'joker') return -1;
  return (
    HAND_SUIT_ORDER.indexOf(left.suit) - HAND_SUIT_ORDER.indexOf(right.suit) ||
    RANKS.indexOf(right.rank) - RANKS.indexOf(left.rank)
  );
}
