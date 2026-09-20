import { describe, expect, it } from 'vitest';

import type { Bid } from './bidding';
import { createDeck, type CardId } from './cards';
import {
  applyCommand,
  createGame,
  legalCommands,
  trickWinner,
  type GameState,
} from './game';
import { projectPlayerView } from './perspective';

const sevenOrdinary: Bid = {
  kind: 'numerical',
  level: 7,
  bidType: 'ordinary',
};

function applyOrThrow(
  state: GameState,
  command: Parameters<typeof applyCommand>[1],
): GameState {
  const result = applyCommand(state, command);

  if (!result.ok) {
    throw new Error(result.error.code);
  }

  return result.state;
}

describe('game bidding state', () => {
  it('starts bidding left of the dealer and forbids an opening pass', () => {
    const state = createGame({ seed: 1, dealer: 3, host: 0 });
    const commands = legalCommands(state, 0);

    expect(state.firstPlayer).toBe(0);
    expect(state.bidding.actor).toBe(0);
    expect(commands.some(({ type }) => type === 'pass')).toBe(false);
    expect(legalCommands(state, 1)).toEqual([]);
  });

  it('always continues clockwise after every bid and pass', () => {
    let state = createGame({ seed: 1, dealer: 3, host: 0 });

    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: sevenOrdinary,
    });
    expect(state.bidding.actor).toBe(1);

    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 1,
      expectedRevision: 1,
      bid: { kind: 'numerical', level: 8, bidType: 'good' },
    });
    expect(state.bidding.actor).toBe(2);

    state = applyOrThrow(state, {
      type: 'pass',
      actor: 2,
      expectedRevision: 2,
    });
    expect(state.bidding.actor).toBe(3);
    expect(state.bidding.bidHolder).toBe(1);

    state = applyOrThrow(state, {
      type: 'pass',
      actor: 3,
      expectedRevision: 3,
    });
    expect(state.bidding.actor).toBe(0);
  });

  it('finishes with one winning bidder after three opponents pass', () => {
    let state = createGame({ seed: 1, dealer: 3, host: 0 });

    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: sevenOrdinary,
    });

    for (const actor of [1, 2, 3] as const) {
      state = applyOrThrow(state, {
        type: 'pass',
        actor,
        expectedRevision: state.revision,
      });
    }

    expect(state.phase).toBe('contract-setup');
    expect(state.declarer).toBe(0);
    expect(state.winningBid).toEqual(sevenOrdinary);
  });

  it('sets clubs as trump automatically when a good contract wins', () => {
    let state = createGame({ seed: 5, dealer: 3, host: 0 });
    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: { kind: 'numerical', level: 7, bidType: 'good' },
    });
    for (const actor of [1, 2, 3] as const) {
      state = applyOrThrow(state, {
        type: 'pass',
        actor,
        expectedRevision: state.revision,
      });
    }

    expect(state.contract.trump).toBe('clubs');
    expect(
      legalCommands(state, 0).every(({ type }) => type === 'call-partner'),
    ).toBe(true);
    expect(state.publicEvents.at(-1)).toMatchObject({
      type: 'trump-chosen',
      trump: 'clubs',
    });
  });

  it('rejects stale, out-of-turn, and non-increasing bids', () => {
    const initial = createGame({ seed: 1, dealer: 3, host: 0 });
    const opened = applyOrThrow(initial, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: sevenOrdinary,
    });

    expect(
      applyCommand(opened, {
        type: 'pass',
        actor: 1,
        expectedRevision: 0,
      }),
    ).toEqual({ ok: false, error: { code: 'stale-command' } });
    expect(
      applyCommand(opened, {
        type: 'pass',
        actor: 2,
        expectedRevision: 1,
      }),
    ).toEqual({ ok: false, error: { code: 'wrong-actor' } });
    expect(
      applyCommand(opened, {
        type: 'place-bid',
        actor: 1,
        expectedRevision: 1,
        bid: sevenOrdinary,
      }),
    ).toEqual({ ok: false, error: { code: 'bid-not-higher' } });
  });
});

describe('ordinary contract and trick play', () => {
  function finishBidding(): GameState {
    let state = createGame({ seed: 77, dealer: 3, host: 0 });
    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: sevenOrdinary,
    });
    for (const actor of [1, 2, 3] as const) {
      state = applyOrThrow(state, {
        type: 'pass',
        actor,
        expectedRevision: state.revision,
      });
    }
    return state;
  }

  it('chooses trump, calls a legal partner card, and enters trick play', () => {
    let state = finishBidding();
    state = applyOrThrow(state, {
      type: 'choose-trump',
      actor: 0,
      expectedRevision: state.revision,
      trump: 'hearts',
    });
    const call = legalCommands(state, 0).find(
      (command) =>
        command.type === 'call-partner' &&
        state.hands
          .slice(1)
          .some((hand) => hand.some(({ id }) => id === command.cardId)),
    );
    if (!call) throw new Error('Expected a legal partner call.');
    state = applyOrThrow(state, call);
    state = applyOrThrow(state, {
      type: 'skip-exchange',
      actor: 0,
      expectedRevision: state.revision,
    });

    expect(state.phase).toBe('trick-play');
    expect(state.trickPlay.actor).toBe(state.firstPlayer);
    expect(state.contract.trump).toBe('hearts');
  });

  it('exchanges 1-3 selected cards without turning discards into new kitty cards', () => {
    let state = finishBidding();
    state = applyOrThrow(state, {
      type: 'choose-trump',
      actor: 0,
      expectedRevision: state.revision,
      trump: 'hearts',
    });
    const call = legalCommands(state, 0).find(
      (command) => command.type === 'call-partner',
    );
    if (!call) throw new Error('Expected a legal partner call.');
    state = applyOrThrow(state, call);
    const discardedCardIds = state.hands[0].slice(0, 2).map(({ id }) => id);
    const kittyCardIds = state.kitty.slice(0, 2).map(({ id }) => id);
    const originalIds = new Set(
      [...state.hands.flat(), ...state.kitty, ...state.discardedCards].map(
        ({ id }) => id,
      ),
    );

    state = applyOrThrow(state, {
      type: 'exchange-cards',
      actor: 0,
      expectedRevision: state.revision,
      discardedCardIds,
    });

    expect(state.phase).toBe('trick-play');
    expect(state.hands[0]).toHaveLength(13);
    expect(state.kitty).toHaveLength(1);
    expect(state.discardedCards.map(({ id }) => id)).toEqual(discardedCardIds);
    expect(state.kitty.some(({ id }) => discardedCardIds.includes(id))).toBe(
      false,
    );
    expect(state.contract.exchangeCount).toBe(2);
    expect(state.publicEvents.at(-1)).toMatchObject({
      type: 'cards-exchanged',
      count: 2,
    });
    const opponentView = JSON.stringify(projectPlayerView(state, 1));
    expect(
      [...discardedCardIds, ...kittyCardIds].every(
        (id) => !opponentView.includes(id),
      ),
    ).toBe(true);
    expect(
      new Set(
        [...state.hands.flat(), ...state.kitty, ...state.discardedCards].map(
          ({ id }) => id,
        ),
      ),
    ).toEqual(originalIds);
  });

  it('rejects invalid counts, duplicate discards, and unavailable discards', () => {
    let state = finishBidding();
    state = applyOrThrow(state, {
      type: 'choose-trump',
      actor: 0,
      expectedRevision: state.revision,
      trump: 'spades',
    });
    const call = legalCommands(state, 0).find(
      (command) => command.type === 'call-partner',
    );
    if (!call) throw new Error('Expected a legal partner call.');
    state = applyOrThrow(state, call);
    const [firstHandCard, secondHandCard] = state.hands[0];
    const unavailableCard = state.hands[1][0];
    if (!firstHandCard || !secondHandCard || !unavailableCard) {
      throw new Error('Expected complete hands and kitty.');
    }
    const handId = firstHandCard.id;

    expect(
      applyCommand(state, {
        type: 'exchange-cards',
        actor: 0,
        expectedRevision: state.revision,
        discardedCardIds: [],
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-exchange-count' } });
    expect(
      applyCommand(state, {
        type: 'exchange-cards',
        actor: 0,
        expectedRevision: state.revision,
        discardedCardIds: [handId, handId],
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-exchange-cards' } });
    expect(
      applyCommand(state, {
        type: 'exchange-cards',
        actor: 0,
        expectedRevision: state.revision,
        discardedCardIds: [unavailableCard.id],
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-exchange-cards' } });
  });

  it('plays all 13 tricks using only engine-generated legal commands', () => {
    let state = finishBidding();
    state = applyOrThrow(state, {
      type: 'choose-trump',
      actor: 0,
      expectedRevision: state.revision,
      trump: 'clubs',
    });
    const call = legalCommands(state, 0).find(
      (command) => command.type === 'call-partner',
    );
    if (!call) throw new Error('Expected a legal partner call.');
    state = applyOrThrow(state, call);
    state = applyOrThrow(state, {
      type: 'skip-exchange',
      actor: 0,
      expectedRevision: state.revision,
    });

    while (state.phase === 'trick-play') {
      const command = legalCommands(state, state.trickPlay.actor)[0];
      if (!command) throw new Error('Expected a legal card play.');
      state = applyOrThrow(state, command);
    }

    expect(state.phase).toBe('scoring');
    expect(state.trickPlay.completedTricks).toHaveLength(13);
    expect(
      state.trickPlay.trickCounts.reduce((sum, count) => sum + count, 0),
    ).toBe(13);
    expect(state.hands.flat()).toHaveLength(0);
  });
});

describe('halves contract setup', () => {
  function finishHalvesBidding(): GameState {
    let state = createGame({ seed: 91, dealer: 3, host: 0 });
    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: { kind: 'numerical', level: 8, bidType: 'halves' },
    });
    for (const actor of [1, 2, 3] as const) {
      state = applyOrThrow(state, {
        type: 'pass',
        actor,
        expectedRevision: state.revision,
      });
    }
    return state;
  }

  it('lets the declarer call first, then the revealed partner chooses a different trump and exchanges', () => {
    let state = finishHalvesBidding();
    const call = legalCommands(state, 0).find(
      (command) =>
        command.type === 'call-partner' &&
        state.hands
          .slice(1)
          .some((hand) => hand.some(({ id }) => id === command.cardId)),
    );
    if (!call || call.type !== 'call-partner')
      throw new Error('Expected a halves partner call.');
    const calledSuit = call.cardId.split(':')[0];
    state = applyOrThrow(state, call);
    const partner = state.contract.partner;
    if (partner === null) throw new Error('Expected a resolved partner.');

    expect(state.contract.publicPartner).toBe(partner);
    const partnerView = JSON.stringify(projectPlayerView(state, partner));
    expect(state.kitty.every(({ id }) => !partnerView.includes(id))).toBe(true);
    expect(state.publicEvents.at(-1)).toMatchObject({
      type: 'partner-revealed',
      seat: partner,
    });
    const trumpCommands = legalCommands(state, partner).filter(
      (command) => command.type === 'choose-trump',
    );
    expect(trumpCommands).toHaveLength(3);
    expect(trumpCommands.some((command) => command.trump === calledSuit)).toBe(
      false,
    );
    expect(legalCommands(state, 0)).toEqual(partner === 0 ? trumpCommands : []);

    const trump = trumpCommands[0];
    if (!trump) throw new Error('Expected a legal trump choice.');
    state = applyOrThrow(state, trump);
    const skip = legalCommands(state, partner).find(
      (command) => command.type === 'skip-exchange',
    );
    if (!skip) throw new Error('Expected partner exchange choice.');
    state = applyOrThrow(state, skip);
    expect(state.phase).toBe('trick-play');
  });

  it('plays and scores a complete halves round', () => {
    let state = finishHalvesBidding();
    const call = legalCommands(state, 0).find(
      (command) => command.type === 'call-partner',
    );
    if (!call) throw new Error('Expected a halves partner call.');
    state = applyOrThrow(state, call);
    const partner = state.contract.partner;
    if (partner === null) throw new Error('Expected a resolved partner.');
    const trump = legalCommands(state, partner).find(
      (command) => command.type === 'choose-trump',
    );
    if (!trump) throw new Error('Expected a legal trump choice.');
    state = applyOrThrow(state, trump);
    const skip = legalCommands(state, partner).find(
      (command) => command.type === 'skip-exchange',
    );
    if (!skip) throw new Error('Expected partner exchange choice.');
    state = applyOrThrow(state, skip);

    while (state.phase === 'trick-play') {
      const command = legalCommands(state, state.trickPlay.actor)[0];
      if (!command) throw new Error('Expected a legal card play.');
      state = applyOrThrow(state, command);
    }

    expect(state.phase).toBe('scoring');
    expect(state.score?.status).toBe('scored');
  });
});

describe('provisional vip contract setup', () => {
  function finishVipBidding(seed: number): GameState {
    let state = createGame({ seed, dealer: 3, host: 0 });
    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: { kind: 'numerical', level: 7, bidType: 'vip' },
    });
    for (const actor of [1, 2, 3] as const) {
      state = applyOrThrow(state, {
        type: 'pass',
        actor,
        expectedRevision: state.revision,
      });
    }
    return state;
  }

  it('reveals one suited kitty card, permits stopping, and requires taking every revealed card', () => {
    let seed = 0;
    while (createGame({ seed, dealer: 3, host: 0 }).kitty[0]?.kind !== 'suited')
      seed += 1;
    let state = finishVipBidding(seed);
    const reveal = legalCommands(state, 0).find(
      (command) => command.type === 'reveal-vip-card',
    );
    if (!reveal) throw new Error('Expected a Vip reveal.');
    state = applyOrThrow(state, reveal);
    expect(state.contract.vipRevealedCardIds).toHaveLength(1);
    const stop = legalCommands(state, 0).find(
      (command) => command.type === 'stop-vip',
    );
    if (!stop) throw new Error('Expected Vip to permit stopping.');
    state = applyOrThrow(state, stop);
    const call = legalCommands(state, 0).find(
      (command) => command.type === 'call-partner',
    );
    if (!call) throw new Error('Expected a legal partner call.');
    state = applyOrThrow(state, call);
    const exchangeCommands = legalCommands(state, 0);
    expect(
      exchangeCommands.some((command) => command.type === 'skip-exchange'),
    ).toBe(false);
    expect(
      exchangeCommands.every(
        (command) =>
          command.type === 'exchange-cards' &&
          command.discardedCardIds.length === 1,
      ),
    ).toBe(true);
    const exchange = exchangeCommands[0];
    if (!exchange) throw new Error('Expected a mandatory Vip exchange.');
    state = applyOrThrow(state, exchange);
    expect(state.phase).toBe('trick-play');
    while (state.phase === 'trick-play') {
      const play = legalCommands(state, state.trickPlay.actor)[0];
      if (!play) throw new Error('Expected a legal Vip card play.');
      state = applyOrThrow(state, play);
    }
    expect(state.score).toMatchObject({ status: 'scored', pointValue: 3 });
  });

  it('provisionally permits free trump choice when the first reveal is a joker', () => {
    let seed = 0;
    while (createGame({ seed, dealer: 3, host: 0 }).kitty[0]?.kind !== 'joker')
      seed += 1;
    let state = finishVipBidding(seed);
    const reveal = legalCommands(state, 0)[0];
    if (!reveal) throw new Error('Expected a Vip reveal.');
    state = applyOrThrow(state, reveal);

    expect(state.contract.trump).toBeNull();
    expect(state.contract.vipTrumpResolved).toBe(false);
    const choices = legalCommands(state, 0);
    expect(choices.map(({ type }) => type)).toEqual([
      'choose-trump',
      'choose-trump',
      'choose-trump',
      'choose-trump',
    ]);
    state = applyOrThrow(state, choices[2]!);
    expect(state.contract.trump).toBe('hearts');
    expect(state.contract.vipTrumpResolved).toBe(true);
    expect(
      legalCommands(state, 0).some(({ type }) => type === 'call-partner'),
    ).toBe(true);
  });
});

describe('no-trump special contracts', () => {
  function finishSpecialBidding(
    bidType: 'sol' | 'pure-sol' | 'open-laydown' | 'super-laydown',
  ): GameState {
    let state = createGame({ seed: 143, dealer: 3, host: 0 });
    state = applyOrThrow(state, {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: { kind: 'special', bidType },
    });
    for (const actor of [1, 2, 3] as const) {
      state = applyOrThrow(state, {
        type: 'pass',
        actor,
        expectedRevision: state.revision,
      });
    }
    return state;
  }

  it.each(['sol', 'pure-sol', 'open-laydown', 'super-laydown'] as const)(
    'enters %s play without trump or a partner and reaches a score',
    (bidType) => {
      let state = finishSpecialBidding(bidType);
      const skip = legalCommands(state, 0).find(
        (command) => command.type === 'skip-exchange',
      );
      if (!skip) throw new Error('Expected a special exchange decision.');
      state = applyOrThrow(state, skip);
      expect(state.contract.trump).toBeNull();
      expect(state.contract.partner).toBeNull();

      while (state.phase === 'trick-play') {
        const play = legalCommands(state, state.trickPlay.actor)[0];
        if (!play) throw new Error('Expected a legal special card play.');
        state = applyOrThrow(state, play);
      }

      expect(state.score).toMatchObject({ status: 'scored' });
    },
  );

  it('makes aces low when resolving a special-contract trick', () => {
    const card = (id: CardId) => {
      const found = createDeck().find((candidate) => candidate.id === id);
      if (!found) throw new Error(`Missing test card ${id}`);
      return found;
    };
    expect(
      trickWinner(
        [
          { seat: 0, card: card('hearts:ace') },
          { seat: 1, card: card('hearts:two') },
          { seat: 2, card: card('hearts:king') },
          { seat: 3, card: card('spades:king') },
        ],
        null,
        true,
      ),
    ).toBe(2);
  });

  it('projects only the hands made public by laydown rules', () => {
    let open = finishSpecialBidding('open-laydown');
    const openSkip = legalCommands(open, 0).find(
      (command) => command.type === 'skip-exchange',
    );
    if (!openSkip) throw new Error('Expected open-laydown setup.');
    open = applyOrThrow(open, openSkip);
    expect(projectPlayerView(open, 1).openHands).toEqual([]);
    const firstPlay = legalCommands(open, open.trickPlay.actor)[0];
    if (!firstPlay) throw new Error('Expected the declarer first play.');
    open = applyOrThrow(open, firstPlay);
    expect(projectPlayerView(open, 1).openHands).toEqual([
      { seat: 0, cards: open.hands[0] },
    ]);

    let superOpen = finishSpecialBidding('super-laydown');
    const superSkip = legalCommands(superOpen, 0).find(
      (command) => command.type === 'skip-exchange',
    );
    if (!superSkip) throw new Error('Expected super-laydown setup.');
    superOpen = applyOrThrow(superOpen, superSkip);
    for (const viewer of [0, 1, 2, 3] as const) {
      const view = projectPlayerView(superOpen, viewer);
      expect(view.openHands).toEqual([{ seat: 0, cards: superOpen.hands[0] }]);
      expect(view.opponents).toEqual(
        [0, 1, 2, 3]
          .filter((seat) => seat !== viewer)
          .map((seat) => ({
            seat,
            cardCount: superOpen.hands[seat as 0 | 1 | 2 | 3].length,
          })),
      );
      const encoded = JSON.stringify(view);
      for (const seat of [1, 2, 3] as const) {
        if (seat === viewer) continue;
        for (const hidden of superOpen.hands[seat])
          expect(encoded).not.toContain(`"id":"${hidden.id}"`);
      }
    }
  });
});

describe('normal trick winner', () => {
  const card = (id: CardId) => {
    const found = createDeck().find((candidate) => candidate.id === id);
    if (!found) throw new Error(`Missing test card ${id}`);
    return found;
  };

  it('lets the highest trump beat the lead suit', () => {
    expect(
      trickWinner(
        [
          { seat: 0, card: card('hearts:ace') },
          { seat: 1, card: card('clubs:two') },
          { seat: 2, card: card('hearts:king') },
          { seat: 3, card: card('clubs:queen') },
        ],
        'clubs',
      ),
    ).toBe(3);
  });

  it('makes a led joker a certain trick', () => {
    expect(
      trickWinner(
        [
          { seat: 2, card: card('joker:1') },
          { seat: 3, card: card('clubs:ace') },
          { seat: 0, card: card('clubs:king') },
          { seat: 1, card: card('joker:2') },
        ],
        'clubs',
      ),
    ).toBe(2);
  });

  it('makes a joker played after the lead unable to win', () => {
    expect(
      trickWinner(
        [
          { seat: 0, card: card('diamonds:ten') },
          { seat: 1, card: card('joker:1') },
          { seat: 2, card: card('diamonds:ace') },
          { seat: 3, card: card('spades:ace') },
        ],
        'clubs',
      ),
    ).toBe(2);
  });
});
