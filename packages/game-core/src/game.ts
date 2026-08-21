import {
  availableBids,
  isHigherBid,
  type Bid,
  type BiddingState,
} from './bidding';
import { RANKS, SUITS, type Card, type CardId, type Suit } from './cards';
import { createSeededDeal, SEATS, type Hand, type Seat } from './deal';
import type { ShuffleSeed } from './random';
import { scoreNumericalContract, type NumericalScore } from './scoring';

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
  readonly bidding: BiddingState;
  readonly winningBid: Bid | null;
  readonly declarer: Seat | null;
  readonly contract: ContractState;
  readonly trickPlay: TrickPlayState;
  readonly score: NumericalScore | null;
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
    bidding: {
      actor: firstPlayer,
      currentBid: null,
      bidHolder: null,
      waitingSeats: [1, 2, 3].map(
        (offset) => ((firstPlayer + offset) % 4) as Seat,
      ),
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

  if (state.phase === 'contract-setup' && state.declarer === seat) {
    if (!isSupportedContract(state.winningBid)) return [];
    if (!state.contract.trump) {
      return SUITS.map((trump) => ({
        type: 'choose-trump',
        actor: seat,
        expectedRevision: state.revision,
        trump,
      }));
    }
    if (!state.contract.calledPartnerCardId) {
      return callablePartnerCards(state).map((cardId) => ({
        type: 'call-partner',
        actor: seat,
        expectedRevision: state.revision,
        cardId,
      }));
    }
    return [
      { type: 'skip-exchange', actor: seat, expectedRevision: state.revision },
    ];
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
  return playCard(state, command);
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
    const previousHolder = state.bidding.bidHolder;
    const nextActor = previousHolder ?? state.bidding.waitingSeats[0];
    if (nextActor === undefined)
      throw new Error('Bidding state has no opponent.');
    return success(state, revision, [event], {
      bidding: {
        ...state.bidding,
        actor: nextActor,
        currentBid: command.bid,
        bidHolder: command.actor,
        waitingSeats:
          previousHolder !== null
            ? state.bidding.waitingSeats
            : state.bidding.waitingSeats.slice(1),
      },
    });
  }

  const { bidHolder, currentBid, waitingSeats } = state.bidding;
  if (bidHolder === null || !currentBid)
    return reject('opening-pass-forbidden');
  const revision = state.revision + 1;
  const passEvent = {
    type: 'player-passed' as const,
    seat: command.actor,
    revision,
  };
  const nextChallenger = waitingSeats[0];
  if (nextChallenger !== undefined) {
    return success(state, revision, [passEvent], {
      bidding: {
        ...state.bidding,
        actor: nextChallenger,
        waitingSeats: waitingSeats.slice(1),
        passedSeats: [...state.bidding.passedSeats, command.actor],
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
        passedSeats: [...state.bidding.passedSeats, command.actor],
      },
    },
  );
}

function isSupportedContract(bid: Bid | null): bid is Bid {
  return (
    bid?.kind === 'numerical' &&
    (bid.bidType === 'ordinary' || bid.bidType === 'good')
  );
}

function chooseTrump(
  state: GameState,
  command: Extract<GameCommand, { type: 'choose-trump' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== state.declarer) return reject('wrong-actor');
  if (!isSupportedContract(state.winningBid))
    return reject('unsupported-contract');
  if (state.contract.trump) return reject('invalid-trump');
  const revision = state.revision + 1;
  const event = {
    type: 'trump-chosen' as const,
    seat: command.actor,
    trump: command.trump,
    revision,
  };
  return success(state, revision, [event], {
    contract: { ...state.contract, trump: command.trump },
  });
}

function callablePartnerCards(state: GameState): readonly CardId[] {
  const declarer = state.declarer;
  const trump = state.contract.trump;
  if (declarer === null || !trump) return [];
  const ownIds = new Set(state.hands[declarer].map(({ id }) => id));
  const aceIds = SUITS.filter((suit) => suit !== trump)
    .map((suit) => `${suit}:ace` as CardId)
    .filter((id) => !ownIds.has(id));
  if (aceIds.length > 0) return aceIds;
  return SUITS.filter((suit) => suit !== trump)
    .map((suit) => `${suit}:king` as CardId)
    .filter((id) => !ownIds.has(id));
}

function callPartner(
  state: GameState,
  command: Extract<GameCommand, { type: 'call-partner' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== state.declarer) return reject('wrong-actor');
  if (!state.contract.trump) return reject('trump-required');
  if (!callablePartnerCards(state).includes(command.cardId))
    return reject('invalid-partner-card');
  const partner =
    SEATS.find((seat) =>
      state.hands[seat].some(({ id }) => id === command.cardId),
    ) ?? null;
  const revision = state.revision + 1;
  const event = {
    type: 'partner-called' as const,
    seat: command.actor,
    cardId: command.cardId,
    revision,
  };
  return success(state, revision, [event], {
    contract: {
      ...state.contract,
      calledPartnerCardId: command.cardId,
      partner,
    },
  });
}

function skipExchange(
  state: GameState,
  command: Extract<GameCommand, { type: 'skip-exchange' }>,
): TransitionResult {
  if (state.phase !== 'contract-setup') return reject('wrong-phase');
  if (command.actor !== state.declarer) return reject('wrong-actor');
  if (!state.contract.calledPartnerCardId)
    return reject('partner-card-required');
  const revision = state.revision + 1;
  const event = {
    type: 'exchange-skipped' as const,
    seat: command.actor,
    revision,
  };
  return success(state, revision, [event], {
    phase: 'trick-play',
    contract: { ...state.contract, exchangeSkipped: true },
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

  const winner = trickWinner(currentTrick, state.contract.trump);
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
  const finished = completedTricks.length === 13;
  const score =
    finished &&
    state.winningBid?.kind === 'numerical' &&
    state.declarer !== null
      ? scoreNumericalContract(
          state.winningBid,
          state.declarer,
          state.contract.partner,
          trickCounts,
        )
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
    return RANKS.indexOf(play.card.rank) > RANKS.indexOf(best.card.rank)
      ? play
      : best;
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
