import { createDeck } from '@whistzilla/game-core';
import { describe, expect, it } from 'vitest';

import { CARD_RANK_LABELS, compareHandCards } from './presentation';

describe('card presentation', () => {
  it('uses international court-card labels', () => {
    expect(CARD_RANK_LABELS).toMatchObject({
      ace: 'A',
      king: 'K',
      queen: 'Q',
      jack: 'J',
    });
  });

  it('groups suits and sorts each suit from ace down', () => {
    const ids = createDeck()
      .filter(({ id }) =>
        [
          'clubs:ace',
          'hearts:two',
          'diamonds:jack',
          'hearts:ace',
          'spades:king',
          'diamonds:ace',
          'joker:1',
        ].includes(id),
      )
      .sort(compareHandCards)
      .map(({ id }) => id);

    expect(ids).toEqual([
      'hearts:ace',
      'hearts:two',
      'diamonds:ace',
      'diamonds:jack',
      'spades:king',
      'clubs:ace',
      'joker:1',
    ]);
  });
});
