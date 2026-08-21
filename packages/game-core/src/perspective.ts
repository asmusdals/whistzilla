import type { Bid } from './bidding';
import type { Card } from './cards';
import {
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

export interface PlayerView {
  readonly revision: number;
  readonly phase: GamePhase;
  readonly viewer: Seat;
  readonly dealer: Seat;
  readonly host: Seat;
  readonly firstPlayer: Seat;
  readonly ownHand: readonly Card[];
  readonly opponents: readonly OpponentView[];
  readonly kittyCardCount: number;
  readonly currentBid: Bid | null;
  readonly biddingActor: Seat;
  readonly winningBid: Bid | null;
  readonly declarer: Seat | null;
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
    kittyCardCount: state.kitty.length,
    currentBid: state.bidding.currentBid,
    biddingActor: state.bidding.actor,
    winningBid: state.winningBid,
    declarer: state.declarer,
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
