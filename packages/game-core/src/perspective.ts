import type { Bid } from './bidding';
import type { Card } from './cards';
import {
  contractSetupActor,
  legalCommands,
  type GameCommand,
  type GamePhase,
  type GameState,
  type PlayedCard,
  type PublicGameEvent,
} from './game';
import { SEATS, type Seat } from './deal';

export interface OpponentView {
  readonly seat: Seat;
  readonly cardCount: number;
}

export interface OpenHandView {
  readonly seat: Seat;
  readonly cards: readonly Card[];
}

export interface PlayerView {
  readonly revision: number;
  readonly phase: GamePhase;
  readonly viewer: Seat;
  readonly dealer: Seat;
  readonly host: Seat;
  readonly firstPlayer: Seat;
  readonly ownHand: readonly Card[];
  readonly opponents: readonly OpponentView[];
  readonly openHands: readonly OpenHandView[];
  readonly kittyCardCount: number;
  readonly vipRevealedCards: readonly Card[];
  readonly vipTrumpResolved: boolean;
  readonly currentBid: Bid | null;
  readonly biddingActor: Seat;
  readonly winningBid: Bid | null;
  readonly declarer: Seat | null;
  readonly contractActor: Seat | null;
  readonly trump: GameState['contract']['trump'];
  readonly calledPartnerCardId: GameState['contract']['calledPartnerCardId'];
  readonly publicPartner: Seat | null;
  readonly currentTrick: readonly PlayedCard[];
  readonly completedTrickCount: number;
  readonly trickCounts: readonly [number, number, number, number];
  readonly score: GameState['score'];
  readonly publicEvents: readonly PublicGameEvent[];
  readonly legalCommands: readonly GameCommand[];
}

export function projectPlayerView(state: GameState, viewer: Seat): PlayerView {
  const declarerHasPlayed = state.publicEvents.some(
    (event) => event.type === 'card-played' && event.seat === state.declarer,
  );
  const openSeats: readonly Seat[] =
    state.phase === 'trick-play' &&
    state.winningBid?.kind === 'special' &&
    state.declarer !== null &&
    (state.winningBid.bidType === 'super-laydown' ||
      (state.winningBid.bidType === 'open-laydown' && declarerHasPlayed))
      ? [state.declarer]
      : [];
  return {
    revision: state.revision,
    phase: state.phase,
    viewer,
    dealer: state.dealer,
    host: state.host,
    firstPlayer: state.firstPlayer,
    ownHand: state.hands[viewer],
    opponents: SEATS.filter((seat) => seat !== viewer).map((seat) => ({
      seat,
      cardCount: state.hands[seat].length,
    })),
    openHands: openSeats.map((seat) => ({ seat, cards: state.hands[seat] })),
    kittyCardCount: state.kitty.length,
    vipRevealedCards: state.kitty.filter(({ id }) =>
      state.contract.vipRevealedCardIds.includes(id),
    ),
    vipTrumpResolved: state.contract.vipTrumpResolved,
    currentBid: state.bidding.currentBid,
    biddingActor: state.bidding.actor,
    winningBid: state.winningBid,
    declarer: state.declarer,
    contractActor: contractSetupActor(state),
    trump: state.contract.trump,
    calledPartnerCardId: state.contract.calledPartnerCardId,
    publicPartner: state.contract.publicPartner,
    currentTrick: state.trickPlay.currentTrick,
    completedTrickCount: state.trickPlay.completedTricks.length,
    trickCounts: state.trickPlay.trickCounts,
    score: state.score,
    publicEvents: state.publicEvents,
    legalCommands: legalCommands(state, viewer),
  };
}
