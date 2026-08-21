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

  it('melds back until one bidder passes, then advances to the next seat', () => {
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
      bid: { kind: 'numerical', level: 7, bidType: 'halves' },
    });
    expect(state.bidding.actor).toBe(0);

    state = applyOrThrow(state, {
      type: 'pass',
      actor: 0,
      expectedRevision: 2,
    });
    expect(state.bidding.actor).toBe(2);
    expect(state.bidding.bidHolder).toBe(1);
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
      (command) => command.type === 'call-partner',
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
