import type { Card } from '@whistzilla/game-core';

import { CARD_RANK_LABELS } from './presentation';

const SYMBOLS = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
} as const;

export function CardVisual({ card }: { readonly card: Card }) {
  if (card.kind === 'joker') {
    return (
      <div
        className="playing-card joker-card"
        aria-label={`Joker ${card.number}`}
      >
        <span>J</span>
        <strong>Joker</strong>
        <span>{card.number}</span>
      </div>
    );
  }
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div
      className={`playing-card ${red ? 'red-suit' : ''}`}
      aria-label={`${CARD_RANK_LABELS[card.rank]} ${SYMBOLS[card.suit]}`}
    >
      <span className="card-corner">{CARD_RANK_LABELS[card.rank]}</span>
      <strong className="card-suit">{SYMBOLS[card.suit]}</strong>
      <span className="card-corner card-corner-bottom">
        {CARD_RANK_LABELS[card.rank]}
      </span>
    </div>
  );
}
