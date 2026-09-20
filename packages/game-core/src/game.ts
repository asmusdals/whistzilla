import {
  availableBids,
  isHigherBid,
  type Bid,
  type BiddingState,
} from './bidding';
import { RANKS, SUITS, type Card, type CardId, type Suit } from './cards';
import { createSeededDeal, SEATS, type Hand, type Seat } from './deal';
import type { ShuffleSeed } from './random';
import {
  scoreNumericalContract,
  scoreSpecialContract,
  type GameScore,
} from './scoring';

export type GamePhase = 'bidding' | 'contract-setup' | 'trick-play' | 'scoring';

export interface GameConfig {
  readonly seed: ShuffleSeed;
  readonly dealer: Seat;
  readonly host: Seat;
}

export interface PlayedCard {
  readonly seat: Seat;
  readonly card: Card;
}

export interface CompletedTrick {
  readonly leader: Seat;
  readonly winner: Seat;
  readonly cards: readonly PlayedCard[];
}

export interface ContractState {
  readonly trump: Suit | null;
  readonly calledPartnerCardId: CardId | null;
  readonly partner: Seat | null;
  readonly publicPartner: Seat | null;
  readonly exchangeSkipped: boolean;
  readonly exchangeCount: number | null;
  readonly vipRevealedCardIds: readonly CardId[];
  readonly vipTrumpResolved: boolean;
}

export interface TrickPlayState {
  readonly leader: Seat;
  readonly actor: Seat;
  readonly currentTrick: readonly PlayedCard[];
  readonly completedTricks: readonly CompletedTrick[];
  readonly trickCounts: readonly [number, number, number, number];
}

export type PublicGameEvent =
  | {
      readonly type: 'bid-placed';
      readonly seat: Seat;
      readonly bid: Bid;
      readonly revision: number;
    }
  | {
      readonly type: 'player-passed';
      readonly seat: Seat;
      readonly revision: number;
    }
  | {
      readonly type: 'bidding-won';
      readonly seat: Seat;
      readonly bid: Bid;
      readonly revision: number;
    }
  | {
      readonly type: 'trump-chosen';
      readonly seat: Seat;
      readonly trump: Suit;
      readonly revision: number;
    }
  | {
      readonly type: 'partner-called';
      readonly seat: Seat;
      readonly cardId: CardId;
      readonly revision: number;
    }
  | {
      readonly type: 'exchange-skipped';
      readonly seat: Seat;
      readonly revision: number;
    }
  | {
      readonly type: 'cards-exchanged';
      readonly seat: Seat;
      readonly count: number;
      readonly revision: number;
    }
  | {
      readonly type: 'vip-card-revealed';
      readonly seat: Seat;
      readonly card: Card;
      readonly revealNumber: number;
      readonly revision: number;
    }
  | {
      readonly type: 'card-played';
      readonly seat: Seat;
      readonly card: Card;
      readonly revision: number;
    }
  | {
      readonly type: 'partner-revealed';
      readonly seat: Seat;
      readonly revision: number;
    }
  | {
      readonly type: 'trick-won';
      readonly seat: Seat;
      readonly trickNumber: number;
      readonly revision: number;
    };

export interface GameState {
  readonly revision: number;
  readonly phase: GamePhase;
  readonly seed: ShuffleSeed;
  readonly dealer: Seat;
  readonly host: Seat;
  readonly firstPlayer: Seat;
  readonly hands: readonly [Hand, Hand, Hand, Hand];
  readonly kitty: readonly Card[];
  readonly discardedCards: readonly Card[];
  readonly bidding: BiddingState;
  readonly winningBid: Bid | null;
  readonly declarer: Seat | null;
  readonly contract: ContractState;
  readonly trickPlay: TrickPlayState;
  readonly score: GameScore | null;
  readonly publicEvents: readonly PublicGameEvent[];
}

interface CommandBase {
  readonly actor: Seat;
  readonly expectedRevision: number;
}

export type GameCommand =
  | (CommandBase & { readonly type: 'place-bid'; readonly bid: Bid })
  | (CommandBase & { readonly type: 'pass' })
  | (CommandBase & { readonly type: 'choose-trump'; readonly trump: Suit })
  | (CommandBase & { readonly type: 'call-partner'; readonly cardId: CardId })
  | (CommandBase & { readonly type: 'skip-exchange' })
  | (CommandBase & { readonly type: 'reveal-vip-card' })
  | (CommandBase & { readonly type: 'stop-vip' })
  | (CommandBase & {
      readonly type: 'exchange-cards';
      readonly discardedCardIds: readonly CardId[];
    })
  | (CommandBase & { readonly type: 'play-card'; readonly cardId: CardId });

export type PlaceBidCommand = Extract<GameCommand, { type: 'place-bid' }>;
export type PlayCardCommand = Extract<GameCommand, { type: 'play-card' }>;

export type RuleViolationCode =
  | 'stale-command'
  | 'wrong-phase'
  | 'wrong-actor'
  | 'opening-pass-forbidden'
  | 'bid-not-higher'
  | 'unsupported-contract'
  | 'trump-required'
  | 'invalid-trump'
  | 'partner-card-required'
  | 'invalid-partner-card'
  | 'exchange-decision-required'
  | 'invalid-exchange-count'
  | 'invalid-exchange-cards'
  | 'vip-action-unavailable'
  | 'card-not-in-hand'
  | 'illegal-card-play';

export type TransitionResult =
  | {
      readonly ok: true;
      readonly state: GameState;
      readonly events: readonly PublicGameEvent[];
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: RuleViolationCode };
    };

const reject = (code: RuleViolationCode): TransitionResult => ({
  ok: false,
  error: { code },
});
const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;

export function createGame(config: GameConfig): GameState {
  const deal = createSeededDeal(config.seed, config.dealer);
  const firstPlayer = deal.firstRecipient;
  return {
    revision: 0,
    phase: 'bidding',
    seed: config.seed,
    dealer: config.dealer,
    host: config.host,
    firstPlayer,
    hands: deal.hands,
    kitty: deal.kitty,
    discardedCards: [],
    bidding: {
      actor: firstPlayer,
      currentBid: null,
      bidHolder: null,
      passedSeats: [],
    },
    winningBid: null,
    declarer: null,
    contract: {
      trump: null,
      calledPartnerCardId: null,
      partner: null,
      publicPartner: null,
      exchangeSkipped: false,
      exchangeCount: null,
      vipRevealedCardIds: [],
      vipTrumpResolved: false,
    },
    trickPlay: {
      leader: firstPlayer,
      actor: firstPlayer,
      currentTrick: [],
      completedTricks: [],
      trickCounts: [0, 0, 0, 0],
    },
    score: null,
    publicEvents: [],
  };
}

export function legalCommands(
  state: GameState,
  seat: Seat,
): readonly GameCommand[] {
  if (state.phase === 'bidding') {
    if (state.bidding.actor !== seat) return [];
    const commands: GameCommand[] = availableBids(state.bidding.currentBid).map(
      (bid) => ({
        type: 'place-bid',
        actor: seat,
        expectedRevision: state.revision,
        bid,
      }),
    );
    if (state.bidding.currentBid)
      commands.push({
        type: 'pass',
        actor: seat,
        expectedRevision: state.revision,
      });
    return commands;
  }

  if (state.phase === 'contract-setup' && contractSetupActor(state) === seat) {
    if (!isSupportedContract(state.winningBid)) return [];
    const isHalves =
      state.winningBid.kind === 'numerical' &&
      state.winningBid.bidType === 'halves';
    const isVip =
      state.winningBid.kind === 'numerical' &&
      state.winningBid.bidType === 'vip';
    const isSpecial = state.winningBid.kind === 'special';
    if (isVip && !state.contract.vipTrumpResolved) {
      const firstRevealIsJoker =
        state.contract.vipRevealedCardIds.length === 1 &&
        state.kitty.find(
          ({ id }) => id === state.contract.vipRevealedCardIds[0],
        )?.kind === 'joker';
      if (firstRevealIsJoker && !state.contract.trump) {
        return SUITS.map((trump) => ({
          type: 'choose-trump' as const,
          actor: seat,
          expectedRevision: state.revision,
          trump,
        }));
      }
      const commands: GameCommand[] = [
        {
          type: 'reveal-vip-card',
          actor: seat,
          expectedRevision: state.revision,
        },
      ];
      if (state.contract.trump) {
        commands.push({
          type: 'stop-vip',
          actor: seat,
          expectedRevision: state.revision,
        });
      }
      return commands;
    }
    if (isHalves && !state.contract.calledPartnerCardId) {
      return callablePartnerCards(state).map((cardId) => ({
        type: 'call-partner',
        actor: seat,
        expectedRevision: state.revision,
        cardId,
      }));
    }
    if (isSpecial) return exchangeCommands(state, seat);
    if (!state.contract.trump && !isVip) {
      const calledSuit = state.contract.calledPartnerCardId?.split(':')[0];
      return SUITS.filter((trump) => !isHalves || trump !== calledSuit).map(
        (trump) => ({
          type: 'choose-trump' as const,
          actor: seat,
          expectedRevision: state.revision,
          trump,
        }),
      );
    }
    if (!state.contract.calledPartnerCardId) {
      return callablePartnerCards(state).map((cardId) => ({
        type: 'call-partner',
        actor: seat,
        expectedRevision: state.revision,
        cardId,
      }));
    }
    return exchangeCommands(state, seat);
  }

  if (state.phase === 'trick-play' && state.trickPlay.actor === seat) {
    return legalCards(state, seat).map((card) => ({
      type: 'play-card',
      actor: seat,
      expectedRevision: state.revision,
      cardId: card.id,
    }));
  }

  return [];
}

export function applyCommand(
  state: GameState,
  command: GameCommand,
): TransitionResult {
  if (command.expectedRevision !== state.revision)
    return reject('stale-command');

  if (command.type === 'place-bid' || command.type === 'pass') {
    return applyBiddingCommand(state, command);
  }
  if (command.type === 'choose-trump') return chooseTrump(state, command);
  if (command.type === 'call-partner') return callPartner(state, command);
  if (command.type === 'skip-exchange') return skipExchange(state, command);
  if (command.type === 'reveal-vip-card') return revealVipCard(state, command);
  if (command.type === 'stop-vip') return stopVip(state, command);
  if (command.type === 'exchange-cards') return exchangeCards(state, command);
  return playCard(state, command);
}

// Provisional policy for rule 12: ordinary, halves, and good permit 0-3 freely
// selected hand discards and receive the same number of face-down kitty cards.
// Vip requires every revealed kitty card to be taken.
function exchangeCommands(
  state: GameState,
  seat: Seat,
): readonly GameCommand[] {
  const base = { actor: seat, expectedRevision: state.revision } as const;
  const isVip =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'vip';
  const commands: GameCommand[] = isVip
    ? []
    : [{ type: 'skip-exchange', ...base }];
  const counts = isVip ? [state.contract.vipRevealedCardIds.length] : [1, 2, 3];
  for (const count of counts) {
    for (const discardedCardIds of combinations(
      state.hands[seat].map(({ id }) => id),
      count,
    )) {
      commands.push({
        type: 'exchange-cards',
        ...base,
        discardedCardIds,
      });
    }
  }
  return commands;
}

function combinations<T>(values: readonly T[], count: number): readonly T[][] {
  if (count === 0) return [[]];
  return values.flatMap((value, index) =>
    combinations(values.slice(index + 1), count - 1).map((tail) => [
      value,
      ...tail,
    ]),
  );
}

function applyBiddingCommand(
  state: GameState,
  command: Extract<GameCommand, { type: 'place-bid' | 'pass' }>,
): TransitionResult {
  if (state.phase !== 'bidding') return reject('wrong-phase');
  if (command.actor !== state.bidding.actor) return reject('wrong-actor');

  if (command.type === 'place-bid') {
    if (
      state.bidding.currentBid &&
      !isHigherBid(command.bid, state.bidding.currentBid)
    ) {
      return reject('bid-not-higher');
    }
    const revision = state.revision + 1;
    const event = {
      type: 'bid-placed' as const,
      seat: command.actor,
      bid: command.bid,
      revision,
    };
    const nextActor = nextActiveBidder(
      command.actor,
      state.bidding.passedSeats,
    );
    return success(state, revision, [event], {
      bidding: {
        ...state.bidding,
        actor: nextActor,
        currentBid: command.bid,
        bidHolder: command.actor,
      },
    });
  }

  const { bidHolder, currentBid } = state.bidding;
  if (bidHolder === null || !currentBid)
    return reject('opening-pass-forbidden');
  const revision = state.revision + 1;
  const passEvent = {
    type: 'player-passed' as const,
    seat: command.actor,
    revision,
  };
  const passedSeats = [...state.bidding.passedSeats, command.actor];
  const activeSeats = SEATS.filter((seat) => !passedSeats.includes(seat));
  if (activeSeats.length > 1) {
    return success(state, revision, [passEvent], {
      bidding: {
        ...state.bidding,
        actor: nextActiveBidder(command.actor, passedSeats),
        passedSeats,
      },
    });
  }
  const wonEvent = {
    type: 'bidding-won' as const,
    seat: bidHolder,
    bid: currentBid,
    revision,
  };
  const goodTrumpEvent =
    currentBid.kind === 'numerical' && currentBid.bidType === 'good'
      ? {
          type: 'trump-chosen' as const,
          seat: bidHolder,
          trump: 'clubs' as const,
          revision,
        }
      : null;
  return success(
    state,
    revision,
    goodTrumpEvent
      ? [passEvent, wonEvent, goodTrumpEvent]
      : [passEvent, wonEvent],
    {
      phase: 'contract-setup',
      winningBid: currentBid,
      declarer: bidHolder,
      contract: goodTrumpEvent
        ? { ...state.contract, trump: 'clubs' }
        : state.contract,
      bidding: {
        ...state.bidding,
        passedSeats,
      },
    },
  );
}

function nextActiveBidder(from: Seat, passedSeats: readonly Seat[]): Seat {
  for (let offset = 1; offset <= 4; offset += 1) {
    const seat = ((from + offset) % 4) as Seat;
    if (!passedSeats.includes(seat)) return seat;
  }
  throw new Error('Bidding state has no active seat.');
}

function isSupportedContract(bid: Bid | null): bid is Bid {
  return bid !== null;
}

export function contractSetupActor(state: GameState): Seat | null {
  if (state.phase !== 'contract-setup' || state.declarer === null) return null;
  const isHalves =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'halves';
  if (!isHalves || !state.contract.calledPartnerCardId) return state.declarer;
  return state.contract.partner ?? state.declarer;
}

function chooseTrump(
  state: GameState,
  command: Extract<GameCommand, { type: 'choose-trump' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== contractSetupActor(state)) return reject('wrong-actor');
  if (!isSupportedContract(state.winningBid))
    return reject('unsupported-contract');
  if (state.winningBid.kind === 'special') return reject('invalid-trump');
  if (state.contract.trump) return reject('invalid-trump');
  const isVip =
    state.winningBid.kind === 'numerical' && state.winningBid.bidType === 'vip';
  const vipMayChooseAfterOpeningJoker =
    isVip &&
    state.contract.vipRevealedCardIds.length === 1 &&
    state.kitty.find(({ id }) => id === state.contract.vipRevealedCardIds[0])
      ?.kind === 'joker';
  if (isVip && !vipMayChooseAfterOpeningJoker) return reject('invalid-trump');
  const isHalves =
    state.winningBid.kind === 'numerical' &&
    state.winningBid.bidType === 'halves';
  if (
    isHalves &&
    state.contract.calledPartnerCardId?.startsWith(`${command.trump}:`)
  ) {
    return reject('invalid-trump');
  }
  const revision = state.revision + 1;
  const event = {
    type: 'trump-chosen' as const,
    seat: command.actor,
    trump: command.trump,
    revision,
  };
  return success(state, revision, [event], {
    contract: {
      ...state.contract,
      trump: command.trump,
      vipTrumpResolved: isVip ? true : state.contract.vipTrumpResolved,
    },
  });
}

function callablePartnerCards(state: GameState): readonly CardId[] {
  const declarer = state.declarer;
  const trump = state.contract.trump;
  const isHalves =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'halves';
  const resolvedNoTrumpVip =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'vip' &&
    state.contract.vipTrumpResolved;
  if (declarer === null || (!trump && !isHalves && !resolvedNoTrumpVip))
    return [];
  const ownIds = new Set(state.hands[declarer].map(({ id }) => id));
  const legalSuits = SUITS.filter((suit) => !trump || suit !== trump);
  const aceIds = legalSuits
    .map((suit) => `${suit}:ace` as CardId)
    .filter((id) => !ownIds.has(id));
  if (aceIds.length > 0) return aceIds;
  return legalSuits
    .map((suit) => `${suit}:king` as CardId)
    .filter((id) => !ownIds.has(id));
}

function callPartner(
  state: GameState,
  command: Extract<GameCommand, { type: 'call-partner' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== state.declarer) return reject('wrong-actor');
  const isHalves =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'halves';
  const resolvedNoTrumpVip =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'vip' &&
    state.contract.vipTrumpResolved;
  if (!state.contract.trump && !isHalves && !resolvedNoTrumpVip)
    return reject('trump-required');
  if (!callablePartnerCards(state).includes(command.cardId))
    return reject('invalid-partner-card');
  const partner =
    SEATS.find((seat) =>
      state.hands[seat].some(({ id }) => id === command.cardId),
    ) ??
    (state.kitty.some(({ id }) => id === command.cardId)
      ? command.actor
      : null);
  const revision = state.revision + 1;
  const event = {
    type: 'partner-called' as const,
    seat: command.actor,
    cardId: command.cardId,
    revision,
  };
  const halvesRevealsPartner =
    isHalves && partner !== null
      ? ({ type: 'partner-revealed', seat: partner, revision } as const)
      : null;
  return success(
    state,
    revision,
    halvesRevealsPartner ? [event, halvesRevealsPartner] : [event],
    {
      contract: {
        ...state.contract,
        calledPartnerCardId: command.cardId,
        partner,
        publicPartner: halvesRevealsPartner
          ? partner
          : state.contract.publicPartner,
      },
    },
  );
}

function skipExchange(
  state: GameState,
  command: Extract<GameCommand, { type: 'skip-exchange' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== contractSetupActor(state)) return reject('wrong-actor');
  if (
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'vip'
  )
    return reject('exchange-decision-required');
  if (
    state.winningBid?.kind !== 'special' &&
    !state.contract.calledPartnerCardId
  )
    return reject('partner-card-required');
  const revision = state.revision + 1;
  const event = {
    type: 'exchange-skipped' as const,
    seat: command.actor,
    revision,
  };
  return success(state, revision, [event], {
    phase: 'trick-play',
    contract: {
      ...state.contract,
      exchangeSkipped: true,
      exchangeCount: 0,
    },
  });
}

function revealVipCard(
  state: GameState,
  command: Extract<GameCommand, { type: 'reveal-vip-card' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== contractSetupActor(state)) return reject('wrong-actor');
  if (
    state.winningBid?.kind !== 'numerical' ||
    state.winningBid.bidType !== 'vip' ||
    state.contract.vipTrumpResolved
  )
    return reject('vip-action-unavailable');
  const card = state.kitty[state.contract.vipRevealedCardIds.length];
  if (!card) return reject('vip-action-unavailable');
  const revision = state.revision + 1;
  const vipRevealedCardIds = [...state.contract.vipRevealedCardIds, card.id];
  const trump = card.kind === 'suited' ? card.suit : state.contract.trump;
  const vipTrumpResolved = vipRevealedCardIds.length === 3;
  const events: PublicGameEvent[] = [
    {
      type: 'vip-card-revealed',
      seat: command.actor,
      card,
      revealNumber: vipRevealedCardIds.length,
      revision,
    },
  ];
  if (vipTrumpResolved && trump) {
    events.push({
      type: 'trump-chosen',
      seat: command.actor,
      trump,
      revision,
    });
  }
  return success(state, revision, events, {
    contract: {
      ...state.contract,
      trump,
      vipRevealedCardIds,
      vipTrumpResolved,
    },
  });
}

function stopVip(
  state: GameState,
  command: Extract<GameCommand, { type: 'stop-vip' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== contractSetupActor(state)) return reject('wrong-actor');
  if (
    state.winningBid?.kind !== 'numerical' ||
    state.winningBid.bidType !== 'vip' ||
    state.contract.vipTrumpResolved ||
    !state.contract.trump
  )
    return reject('vip-action-unavailable');
  const revision = state.revision + 1;
  const event = {
    type: 'trump-chosen' as const,
    seat: command.actor,
    trump: state.contract.trump,
    revision,
  };
  return success(state, revision, [event], {
    contract: { ...state.contract, vipTrumpResolved: true },
  });
}

function exchangeCards(
  state: GameState,
  command: Extract<GameCommand, { type: 'exchange-cards' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== contractSetupActor(state)) return reject('wrong-actor');
  if (
    state.winningBid?.kind !== 'special' &&
    !state.contract.calledPartnerCardId
  )
    return reject('partner-card-required');
  const count = command.discardedCardIds.length;
  if (count < 1 || count > 3) return reject('invalid-exchange-count');
  const discardedIds = new Set(command.discardedCardIds);
  const isVip =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'vip';
  const kittyCardIds = isVip
    ? state.contract.vipRevealedCardIds
    : state.kitty.slice(0, count).map(({ id }) => id);
  const kittyIds = new Set(kittyCardIds);
  if (
    discardedIds.size !== count ||
    kittyIds.size !== count ||
    !command.discardedCardIds.every((id) =>
      state.hands[command.actor].some((card) => card.id === id),
    ) ||
    !kittyCardIds.every((id) => state.kitty.some((card) => card.id === id))
  ) {
    return reject('invalid-exchange-cards');
  }

  const discarded = state.hands[command.actor].filter(({ id }) =>
    discardedIds.has(id),
  );
  const taken = state.kitty.filter(({ id }) => kittyIds.has(id));
  const replacementHand = [
    ...state.hands[command.actor].filter(({ id }) => !discardedIds.has(id)),
    ...taken,
  ];
  const hands = state.hands.map((hand, seat) =>
    seat === command.actor ? replacementHand : hand,
  ) as [Hand, Hand, Hand, Hand];
  const revision = state.revision + 1;
  const event = {
    type: 'cards-exchanged' as const,
    seat: command.actor,
    count,
    revision,
  };
  const becameSelfPartner = taken.some(
    ({ id }) => id === state.contract.calledPartnerCardId,
  );
  return success(state, revision, [event], {
    phase: 'trick-play',
    hands,
    kitty: state.kitty.filter(({ id }) => !kittyIds.has(id)),
    discardedCards: [...state.discardedCards, ...discarded],
    contract: {
      ...state.contract,
      partner: becameSelfPartner ? command.actor : state.contract.partner,
      exchangeCount: count,
    },
  });
}

export function legalCards(state: GameState, seat: Seat): readonly Card[] {
  const hand = state.hands[seat];
  const trick = state.trickPlay.currentTrick;
  if (state.phase !== 'trick-play' || state.trickPlay.actor !== seat) return [];
  if (state.trickPlay.completedTricks.length === 0 && trick.length === 0) {
    return hand.filter(({ kind }) => kind !== 'joker');
  }
  const lead = trick[0]?.card;
  if (!lead || lead.kind === 'joker') return hand;
  const following = hand.filter(
    (card) => card.kind === 'suited' && card.suit === lead.suit,
  );
  if (following.length === 0) return hand;
  const called = state.contract.calledPartnerCardId;
  const forced = following.find(({ id }) => id === called);
  return forced ? [forced] : following;
}

function playCard(
  state: GameState,
  command: Extract<GameCommand, { type: 'play-card' }>,
): TransitionResult {
  if (state.phase !== 'trick-play') return reject('wrong-phase');
  if (command.actor !== state.trickPlay.actor) return reject('wrong-actor');
  const card = state.hands[command.actor].find(
    ({ id }) => id === command.cardId,
  );
  if (!card) return reject('card-not-in-hand');
  if (!legalCards(state, command.actor).some(({ id }) => id === card.id))
    return reject('illegal-card-play');

  const revision = state.revision + 1;
  const play = { seat: command.actor, card };
  const playedEvent = {
    type: 'card-played' as const,
    seat: command.actor,
    card,
    revision,
  };
  const events: PublicGameEvent[] = [playedEvent];
  const hands = state.hands.map((hand, seat) =>
    seat === command.actor ? hand.filter(({ id }) => id !== card.id) : hand,
  ) as unknown as [Hand, Hand, Hand, Hand];
  const publicPartner =
    card.id === state.contract.calledPartnerCardId
      ? command.actor
      : state.contract.publicPartner;
  if (publicPartner !== state.contract.publicPartner) {
    events.push({ type: 'partner-revealed', seat: command.actor, revision });
  }
  const currentTrick = [...state.trickPlay.currentTrick, play];
  if (currentTrick.length < 4) {
    return success(state, revision, events, {
      hands,
      contract: { ...state.contract, publicPartner },
      trickPlay: {
        ...state.trickPlay,
        actor: nextSeat(command.actor),
        currentTrick,
      },
    });
  }

  const specialContract = state.winningBid?.kind === 'special';
  const winner = trickWinner(
    currentTrick,
    state.contract.trump,
    specialContract,
  );
  const trickCounts = [...state.trickPlay.trickCounts] as [
    number,
    number,
    number,
    number,
  ];
  trickCounts[winner] += 1;
  const completedTricks = [
    ...state.trickPlay.completedTricks,
    { leader: state.trickPlay.leader, winner, cards: currentTrick },
  ];
  events.push({
    type: 'trick-won',
    seat: winner,
    trickNumber: completedTricks.length,
    revision,
  });
  const declarerTricks =
    state.declarer === null ? 0 : trickCounts[state.declarer];
  const specialLost =
    state.winningBid?.kind === 'special' &&
    (state.winningBid.bidType === 'sol'
      ? declarerTricks >= 2
      : declarerTricks >= 1);
  const finished = completedTricks.length === 13 || specialLost;
  const score =
    finished && state.winningBid && state.declarer !== null
      ? state.winningBid.kind === 'numerical'
        ? scoreNumericalContract(
            state.winningBid,
            state.declarer,
            state.contract.partner,
            trickCounts,
            state.contract.vipRevealedCardIds.length,
          )
        : scoreSpecialContract(state.winningBid, state.declarer, trickCounts)
      : null;
  return success(state, revision, events, {
    phase: finished ? 'scoring' : 'trick-play',
    hands,
    contract: { ...state.contract, publicPartner },
    trickPlay: {
      leader: winner,
      actor: winner,
      currentTrick: [],
      completedTricks,
      trickCounts,
    },
    score,
  });
}

export function trickWinner(
  cards: readonly PlayedCard[],
  trump: Suit | null,
  aceLow = false,
): Seat {
  const lead = cards[0];
  if (!lead) throw new Error('Cannot determine the winner of an empty trick.');
  if (lead.card.kind === 'joker') return lead.seat;
  const leadSuit = lead.card.suit;
  const suited = cards.filter((play) => play.card.kind === 'suited');
  const trumpCards = trump
    ? suited.filter(
        (play) => play.card.kind === 'suited' && play.card.suit === trump,
      )
    : [];
  const eligible =
    trumpCards.length > 0
      ? trumpCards
      : suited.filter(
          (play) => play.card.kind === 'suited' && play.card.suit === leadSuit,
        );
  return eligible.reduce((best, play) => {
    if (best.card.kind !== 'suited' || play.card.kind !== 'suited') return best;
    const rankValue = (rank: (typeof RANKS)[number]) =>
      aceLow && rank === 'ace' ? -1 : RANKS.indexOf(rank);
    return rankValue(play.card.rank) > rankValue(best.card.rank) ? play : best;
  }).seat;
}

function success(
  state: GameState,
  revision: number,
  events: readonly PublicGameEvent[],
  patch: Partial<GameState>,
): TransitionResult {
  return {
    ok: true,
    events,
    state: {
      ...state,
      ...patch,
      revision,
      publicEvents: [...state.publicEvents, ...events],
    },
  };
}
