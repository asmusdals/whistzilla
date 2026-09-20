import {
  applyCommand,
  contractSetupActor,
  createDeck,
  createGame,
  projectPlayerView,
  type Card,
  type GameCommand,
  type GameState,
  type Seat,
} from '@whistzilla/game-core';
import { describe, expect, it } from 'vitest';

import {
  analyzeStrategy,
  buildPerspectiveKnowledge,
  chooseStrategyAction,
} from './index';

function apply(state: GameState, command: GameCommand): GameState {
  const result = applyCommand(state, command);
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}

function advanceWithStrategy(state: GameState, seat: Seat): GameState {
  const decision = chooseStrategyAction(projectPlayerView(state, seat));
  if (!decision) throw new Error('Expected a strategy decision.');
  return apply(state, decision.command);
}

function currentActor(state: GameState): Seat {
  const actor =
    state.phase === 'bidding'
      ? state.bidding.actor
      : state.phase === 'trick-play'
        ? state.trickPlay.actor
        : contractSetupActor(state);
  if (actor === null) throw new Error('Expected an actor.');
  return actor;
}

function card(id: Card['id']): Card {
  const found = createDeck().find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing card ${id}`);
  return found;
}

function trickView(
  hand: readonly Card[],
  currentTrick: readonly { readonly seat: Seat; readonly card: Card }[],
  options: { readonly trump?: 'clubs'; readonly declarer?: Seat } = {},
) {
  const base = projectPlayerView(
    createGame({ seed: 4, dealer: 3, host: 0 }),
    2,
  );
  return {
    ...base,
    phase: 'trick-play' as const,
    viewer: 2 as const,
    ownHand: hand,
    currentTrick,
    trump: options.trump ?? null,
    declarer: options.declarer ?? 0,
    winningBid: {
      kind: 'numerical' as const,
      level: 7 as const,
      bidType: 'ordinary' as const,
    },
    legalCommands: hand.map(({ id }) => ({
      type: 'play-card' as const,
      actor: 2 as const,
      expectedRevision: base.revision,
      cardId: id,
    })),
  };
}

describe('practical strategy', () => {
  it('always returns one of the commands exposed by PlayerView', () => {
    let state = createGame({ seed: 42, dealer: 3, host: 0 });
    const opening = projectPlayerView(state, 0).legalCommands.find(
      (command) =>
        command.type === 'place-bid' &&
        command.bid.kind === 'numerical' &&
        command.bid.level === 7 &&
        command.bid.bidType === 'ordinary',
    );
    if (!opening) throw new Error('Expected ordinary opening.');
    state = apply(state, opening);

    const seat = currentActor(state);
    const view = projectPlayerView(state, seat);
    const decision = chooseStrategyAction(view);
    expect(view.legalCommands).toContainEqual(decision?.command);
  });

  it('sometimes raises a human opening and sometimes passes based on its own hand', () => {
    const decisions = Array.from({ length: 80 }, (_, seed) => {
      let state = createGame({ seed, dealer: 3, host: 0 });
      const opening = projectPlayerView(state, 0).legalCommands.find(
        (command) =>
          command.type === 'place-bid' &&
          command.bid.kind === 'numerical' &&
          command.bid.level === 7 &&
          command.bid.bidType === 'ordinary',
      );
      if (!opening) throw new Error('Expected ordinary opening.');
      state = apply(state, opening);
      return chooseStrategyAction(projectPlayerView(state, 1))?.command.type;
    });

    expect(decisions).toContain('place-bid');
    expect(decisions).toContain('pass');
  });

  it('rarely leaves an ordinary 7 opening as the final contract', () => {
    const unchallenged = Array.from({ length: 100 }, (_, seed) => {
      let state = createGame({ seed, dealer: 3, host: 0 });
      const opening = projectPlayerView(state, 0).legalCommands.find(
        (command) =>
          command.type === 'place-bid' &&
          command.bid.kind === 'numerical' &&
          command.bid.level === 7 &&
          command.bid.bidType === 'ordinary',
      );
      if (!opening) throw new Error('Expected ordinary opening.');
      state = apply(state, opening);
      while (state.phase === 'bidding') {
        state = advanceWithStrategy(state, currentActor(state));
      }
      return (
        state.winningBid?.kind === 'numerical' &&
        state.winningBid.level === 7 &&
        state.winningBid.bidType === 'ordinary'
      );
    }).filter(Boolean).length;

    expect(unchallenged).toBeLessThanOrEqual(10);
  });

  it('keeps bidding decisions invariant when inaccessible cards move', () => {
    let state = createGame({ seed: 19, dealer: 3, host: 0 });
    const opening = projectPlayerView(state, 0).legalCommands.find(
      (command) =>
        command.type === 'place-bid' &&
        command.bid.kind === 'numerical' &&
        command.bid.level === 7 &&
        command.bid.bidType === 'ordinary',
    );
    if (!opening) throw new Error('Expected ordinary opening.');
    state = apply(state, opening);
    const hiddenVariant = {
      ...state,
      hands: [
        state.hands[0],
        state.hands[1],
        state.hands[3],
        state.hands[2],
      ] as const,
      kitty: [...state.kitty].reverse(),
    };

    expect(analyzeStrategy(projectPlayerView(hiddenVariant, 1))).toEqual(
      analyzeStrategy(projectPlayerView(state, 1)),
    );
  });

  it('gives each difficulty a distinct willingness to continue bidding', () => {
    const raises = (profile: 'beginner' | 'intermediate' | 'advanced') =>
      Array.from({ length: 100 }, (_, seed) => {
        let state = createGame({ seed, dealer: 3, host: 0 });
        const opening = projectPlayerView(state, 0).legalCommands.find(
          (command) =>
            command.type === 'place-bid' &&
            command.bid.kind === 'numerical' &&
            command.bid.level === 7 &&
            command.bid.bidType === 'ordinary',
        );
        if (!opening) throw new Error('Expected ordinary opening.');
        state = apply(state, opening);
        return chooseStrategyAction(projectPlayerView(state, 1), profile)
          ?.command.type;
      }).filter((type) => type === 'place-bid').length;

    expect(raises('intermediate')).toBeGreaterThan(raises('beginner'));
    expect(raises('advanced')).toBeGreaterThan(raises('intermediate'));
  });

  it('values higher contracts when the hand supports their expected point return', () => {
    const base = projectPlayerView(
      createGame({ seed: 4, dealer: 3, host: 0 }),
      0,
    );
    const bidCommands = ([7, 8, 9, 10, 11, 12, 13] as const).map((level) => ({
      type: 'place-bid' as const,
      actor: 0 as const,
      expectedRevision: base.revision,
      bid: { kind: 'numerical' as const, bidType: 'ordinary' as const, level },
    }));
    const strong = {
      ...base,
      ownHand: [
        'hearts:ace',
        'hearts:king',
        'hearts:queen',
        'hearts:jack',
        'hearts:ten',
        'hearts:nine',
        'hearts:eight',
        'clubs:ace',
        'clubs:king',
        'diamonds:ace',
        'spades:ace',
        'joker:1',
        'joker:2',
      ].map((id) => card(id as Card['id'])),
      legalCommands: bidCommands,
    };
    const weak = {
      ...strong,
      ownHand: [
        'hearts:two',
        'hearts:three',
        'hearts:four',
        'diamonds:two',
        'diamonds:three',
        'diamonds:four',
        'spades:two',
        'spades:three',
        'spades:four',
        'clubs:two',
        'clubs:three',
        'clubs:four',
        'clubs:five',
      ].map((id) => card(id as Card['id'])),
    };

    const strongDecision = chooseStrategyAction(strong, 'advanced')?.command;
    const weakDecision = chooseStrategyAction(weak, 'advanced')?.command;
    expect(strongDecision).toMatchObject({ type: 'place-bid' });
    expect(
      strongDecision?.type === 'place-bid' &&
        strongDecision.bid.kind === 'numerical'
        ? strongDecision.bid.level
        : 0,
    ).toBeGreaterThanOrEqual(9);
    expect(weakDecision).toMatchObject({
      type: 'place-bid',
      bid: { kind: 'numerical', level: 7 },
    });
  });

  it('does not treat an ordinary hand as an automatic special bid', () => {
    const view = projectPlayerView(
      createGame({ seed: 4, dealer: 3, host: 0 }),
      0,
    );
    expect(chooseStrategyAction(view, 'advanced')?.command).toMatchObject({
      type: 'place-bid',
      bid: { kind: 'numerical' },
    });
  });

  it('still recognizes an exceptionally safe Sol hand', () => {
    const base = projectPlayerView(
      createGame({ seed: 4, dealer: 3, host: 0 }),
      0,
    );
    const view = {
      ...base,
      ownHand: [
        ...(['clubs', 'diamonds', 'hearts', 'spades'] as const).flatMap(
          (suit) => [`${suit}:ace`, `${suit}:two`, `${suit}:three`],
        ),
        'joker:1',
      ].map((id) => card(id as Card['id'])),
    };
    expect(chooseStrategyAction(view, 'advanced')?.command).toMatchObject({
      type: 'place-bid',
      bid: { kind: 'special', bidType: 'sol' },
    });
  });

  it('passes an unsupported high overbid', () => {
    const base = projectPlayerView(
      createGame({ seed: 4, dealer: 3, host: 0 }),
      0,
    );
    const view = {
      ...base,
      currentBid: {
        kind: 'numerical' as const,
        level: 9 as const,
        bidType: 'good' as const,
      },
      ownHand: [
        'hearts:two',
        'hearts:three',
        'hearts:four',
        'diamonds:two',
        'diamonds:three',
        'diamonds:four',
        'spades:two',
        'spades:three',
        'spades:four',
        'clubs:two',
        'clubs:three',
        'clubs:four',
        'clubs:five',
      ].map((id) => card(id as Card['id'])),
      legalCommands: [
        { type: 'pass' as const, actor: 0 as const, expectedRevision: 0 },
        {
          type: 'place-bid' as const,
          actor: 0 as const,
          expectedRevision: 0,
          bid: {
            kind: 'numerical' as const,
            bidType: 'ordinary' as const,
            level: 10 as const,
          },
        },
      ],
    };
    expect(chooseStrategyAction(view, 'advanced')?.command.type).toBe('pass');
  });

  it('can play a complete game using only projected player views', () => {
    let state = createGame({ seed: 1234, dealer: 3, host: 0 });
    let decisions = 0;

    while (state.phase !== 'scoring') {
      const actor = currentActor(state);
      state = advanceWithStrategy(state, actor);
      decisions += 1;
      if (decisions > 180) throw new Error('Strategy did not finish the game.');
    }

    expect(state.score?.status).toBe('scored');
    expect(decisions).toBeGreaterThan(10);
  });

  it('gives Advanced a positive score against Beginner over rotated seeded deals', () => {
    let advancedPoints = 0;
    for (let seed = 0; seed < 12; seed += 1) {
      for (const advancedSeat of [0, 1, 2, 3] as const) {
        let state = createGame({ seed, dealer: 3, host: 0 });
        let decisions = 0;
        while (state.phase !== 'scoring') {
          const actor = currentActor(state);
          const profile = actor === advancedSeat ? 'advanced' : 'beginner';
          const command = chooseStrategyAction(
            projectPlayerView(state, actor),
            profile,
          )?.command;
          if (!command) throw new Error('Expected a bot decision.');
          state = apply(state, command);
          decisions += 1;
          if (decisions > 180) throw new Error('Bot game did not finish.');
        }
        advancedPoints += state.score?.deltas[advancedSeat] ?? 0;
      }
    }

    expect(advancedPoints).toBeGreaterThan(0);
  });

  it('plays low in second hand but high enough to win in third hand', () => {
    const ace = card('hearts:ace');
    const two = card('hearts:two');
    const secondHand = trickView(
      [ace, two],
      [{ seat: 1, card: card('hearts:ten') }],
    );
    expect(
      chooseStrategyAction(secondHand, 'intermediate')?.command,
    ).toMatchObject({
      type: 'play-card',
      cardId: two.id,
    });

    const thirdHand = trickView(
      [ace, two],
      [
        { seat: 0, card: card('hearts:ten') },
        { seat: 1, card: card('hearts:king') },
      ],
    );
    expect(
      chooseStrategyAction(thirdHand, 'intermediate')?.command,
    ).toMatchObject({
      type: 'play-card',
      cardId: ace.id,
    });
  });

  it('draws trump from a controlled declarer-side lead', () => {
    const clubsTwo = card('clubs:two');
    const view = trickView(
      [
        clubsTwo,
        card('clubs:king'),
        card('clubs:queen'),
        card('hearts:two'),
        card('hearts:three'),
        card('hearts:four'),
        card('hearts:five'),
      ],
      [],
      { trump: 'clubs', declarer: 2 },
    );
    const decision = chooseStrategyAction(view, 'advanced');
    expect(decision?.command).toMatchObject({ type: 'play-card' });
    expect((decision?.command as { cardId?: string }).cardId).toMatch(
      /^clubs:/,
    );
    expect(decision?.reasons.map(({ code }) => code)).toContain('draw-trump');
    expect(decision?.reasons.map(({ code }) => code)).toContain(
      'sampled-continuation',
    );
  });

  it('does not lead weak short trump just to draw opponents’ trumps', () => {
    const view = trickView(
      [
        card('clubs:two'),
        card('clubs:three'),
        card('hearts:two'),
        card('hearts:three'),
        card('hearts:four'),
        card('hearts:five'),
      ],
      [],
      { trump: 'clubs', declarer: 2 },
    );
    const decision = chooseStrategyAction(view, 'advanced');
    expect(decision?.command).toMatchObject({ cardId: 'hearts:two' });
    expect(decision?.reasons.map(({ code }) => code)).not.toContain(
      'draw-trump',
    );
  });

  it('cashes the highest remaining trump after higher trumps are publicly gone', () => {
    const clubsKing = card('clubs:king');
    const base = trickView(
      [clubsKing, card('clubs:two'), card('hearts:two')],
      [],
      { trump: 'clubs', declarer: 2 },
    );
    const view = {
      ...base,
      publicEvents: [
        {
          type: 'card-played' as const,
          seat: 0 as const,
          card: card('clubs:ace'),
          revision: 1,
        },
      ],
    };

    const decision = chooseStrategyAction(view, 'advanced');
    expect(decision?.command).toMatchObject({ cardId: clubsKing.id });
    expect(decision?.reasons.map(({ code }) => code)).toContain('cash-winner');
  });

  it('does not claim a perfect-information plan from only the open declarer hand', () => {
    const heartsQueen = card('hearts:queen');
    const clubsQueen = card('clubs:queen');
    const base = trickView([heartsQueen, clubsQueen], []);
    const view = {
      ...base,
      winningBid: {
        kind: 'special' as const,
        bidType: 'super-laydown' as const,
      },
      declarer: 0 as const,
      openHands: [
        {
          seat: 0 as const,
          cards: [card('hearts:king'), card('clubs:ace')],
        },
      ],
    };

    const decision = chooseStrategyAction(view, 'advanced');
    expect(view.legalCommands).toContainEqual(decision?.command);
    expect(decision?.reasons.map(({ code }) => code)).not.toContain(
      'open-hand-forcing',
    );
    expect(decision?.reasons.map(({ code }) => code)).not.toContain(
      'open-endgame-plan',
    );
  });

  it('ranks every legal candidate and remembers only public card play', () => {
    let state = createGame({ seed: 87, dealer: 3, host: 0 });

    while (
      state.phase !== 'trick-play' ||
      state.trickPlay.completedTricks.length < 2
    ) {
      const actor = currentActor(state);
      state = advanceWithStrategy(state, actor);
    }

    const view = projectPlayerView(state, state.trickPlay.actor);
    const analysis = analyzeStrategy(view, 'advanced');
    const knowledge = buildPerspectiveKnowledge(view);

    expect(analysis.candidates.map(({ command }) => command)).toEqual(
      expect.arrayContaining([...view.legalCommands]),
    );
    expect(analysis.candidates).toHaveLength(view.legalCommands.length);
    expect(knowledge.playedCardIds).toHaveLength(8);
    expect(knowledge.playedCardIds).not.toEqual(
      expect.arrayContaining(view.ownHand.map(({ id }) => id)),
    );
  });

  it('keeps Advanced play unchanged when inaccessible hands and kitty are rearranged', () => {
    let state = createGame({ seed: 93, dealer: 3, host: 0 });
    while (state.phase !== 'trick-play') {
      state = advanceWithStrategy(state, currentActor(state));
    }
    const viewer = state.trickPlay.actor;
    const hiddenSeats = ([0, 1, 2, 3] as Seat[]).filter(
      (seat) => seat !== viewer,
    );
    const firstHidden = hiddenSeats[0];
    const secondHidden = hiddenSeats[1];
    if (firstHidden === undefined || secondHidden === undefined)
      throw new Error('Expected hidden seats.');
    const hands = state.hands.map((hand, seat) =>
      seat === firstHidden
        ? state.hands[secondHidden]
        : seat === secondHidden
          ? state.hands[firstHidden]
          : hand,
    ) as unknown as typeof state.hands;
    const hiddenVariant = {
      ...state,
      hands,
      kitty: [...state.kitty].reverse(),
    };

    expect(projectPlayerView(hiddenVariant, viewer)).toEqual(
      projectPlayerView(state, viewer),
    );
    expect(
      analyzeStrategy(projectPlayerView(hiddenVariant, viewer), 'advanced'),
    ).toEqual(analyzeStrategy(projectPlayerView(state, viewer), 'advanced'));
  });

  it('treats a legal joker discard as public proof of a void suit', () => {
    const base = trickView([card('clubs:two')], []);
    const view = {
      ...base,
      publicEvents: [
        {
          type: 'card-played' as const,
          seat: 0 as const,
          card: card('hearts:ten'),
          revision: 1,
        },
        {
          type: 'card-played' as const,
          seat: 1 as const,
          card: card('joker:1'),
          revision: 2,
        },
      ],
    };

    expect(buildPerspectiveKnowledge(view).voidSuitsBySeat[1]).toContain(
      'hearts',
    );
  });

  it('limits remembered completed tricks by difficulty while keeping the current trick', () => {
    const base = trickView([card('clubs:two')], []);
    const view = {
      ...base,
      completedTrickCount: 5,
      publicEvents: createDeck()
        .slice(0, 21)
        .map((playedCard, index) => ({
          type: 'card-played' as const,
          seat: (index % 4) as Seat,
          card: playedCard,
          revision: index + 1,
        })),
    };

    expect(
      analyzeStrategy(view, 'beginner').knowledge.playedCardIds,
    ).toHaveLength(1);
    expect(
      analyzeStrategy(view, 'intermediate').knowledge.playedCardIds,
    ).toHaveLength(17);
    expect(
      analyzeStrategy(view, 'advanced').knowledge.playedCardIds,
    ).toHaveLength(21);
  });

  it('treats the declarer partner as an opponent when defending', () => {
    const base = trickView(
      [card('hearts:ace'), card('hearts:two')],
      [
        { seat: 0, card: card('hearts:ten') },
        { seat: 1, card: card('hearts:king') },
      ],
    );
    const view = { ...base, publicPartner: 1 as Seat };
    expect(chooseStrategyAction(view, 'advanced')?.command).toMatchObject({
      type: 'play-card',
      cardId: 'hearts:ace',
    });
  });

  it('preserves a fellow defender’s winning card', () => {
    const base = trickView(
      [card('hearts:ace'), card('hearts:two')],
      [
        { seat: 0, card: card('hearts:ten') },
        { seat: 1, card: card('hearts:king') },
      ],
    );
    const view = { ...base, publicPartner: 3 as Seat };
    expect(chooseStrategyAction(view, 'advanced')?.command).toMatchObject({
      type: 'play-card',
      cardId: 'hearts:two',
    });
  });
});
