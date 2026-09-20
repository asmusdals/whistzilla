import type { NumericalBid, SpecialBid } from './bidding';
import { SEATS, type Seat } from './deal';

export type ScoreDeltas = readonly [number, number, number, number];

export interface ScoredNumericalContract {
  readonly status: 'scored';
  readonly contractSucceeded: boolean;
  readonly declarerTeamTricks: number;
  readonly pointValue: number;
  readonly deltas: ScoreDeltas;
}

export type NumericalScore = ScoredNumericalContract;
export type OrdinaryScore = NumericalScore;

export interface ScoredSpecialContract {
  readonly status: 'scored';
  readonly contractSucceeded: boolean;
  readonly declarerTricks: number;
  readonly pointValue: number;
  readonly deltas: ScoreDeltas;
}

export type GameScore = NumericalScore | ScoredSpecialContract;

const SPECIAL_POINT_VALUES = {
  sol: 16,
  'pure-sol': 32,
  'open-laydown': 64,
  'super-laydown': 128,
} as const;

// Confirmed rule 38 policy: a lost special uses its normal value with the
// opposite sign. All specials are one declarer against three opponents.
export function scoreSpecialContract(
  bid: SpecialBid,
  declarer: Seat,
  trickCounts: readonly [number, number, number, number],
): ScoredSpecialContract {
  const declarerTricks = trickCounts[declarer];
  const contractSucceeded =
    bid.bidType === 'sol' ? declarerTricks <= 1 : declarerTricks === 0;
  const pointValue = SPECIAL_POINT_VALUES[bid.bidType];
  const deltas = SEATS.map((seat) => {
    const won = seat === declarer ? contractSucceeded : !contractSucceeded;
    const stake = seat === declarer ? pointValue * 3 : pointValue;
    return won ? stake : -stake;
  }) as [number, number, number, number];
  return {
    status: 'scored',
    contractSucceeded,
    declarerTricks,
    pointValue,
    deltas,
  };
}

export function scoreNumericalContract(
  bid: NumericalBid,
  declarer: Seat,
  partner: Seat | null,
  trickCounts: readonly [number, number, number, number],
  vipRevealCount?: number,
): NumericalScore {
  if (
    bid.bidType !== 'ordinary' &&
    bid.bidType !== 'halves' &&
    bid.bidType !== 'good' &&
    bid.bidType !== 'vip'
  ) {
    throw new Error('Scoring is not implemented for this contract.');
  }

  // Provisional rule 36 policy: a missing/resolved-in-kitty partner is scored
  // as self-partner, one declarer against three opponents.
  const selfPartner = partner === null || partner === declarer;
  const declarerTeamTricks =
    trickCounts[declarer] +
    (partner === null || selfPartner ? 0 : trickCounts[partner]);

  const contractMultiplier =
    bid.bidType === 'ordinary'
      ? 1
      : bid.bidType === 'vip'
        ? ([3, 4, 6][(vipRevealCount ?? 1) - 1] ?? 3)
        : 2;
  const pointValue = contractMultiplier * 2 ** (bid.level - 7);
  const contractSucceeded = declarerTeamTricks >= bid.level;
  const amount = contractSucceeded
    ? pointValue * (declarerTeamTricks - 6)
    : pointValue * (bid.level - declarerTeamTricks + 1);
  const deltas = selfPartner
    ? (SEATS.map((seat) => {
        const won = seat === declarer ? contractSucceeded : !contractSucceeded;
        const stake = seat === declarer ? amount * 3 : amount;
        return won ? stake : -stake;
      }) as [number, number, number, number])
    : (SEATS.map((seat) => {
        const declarerTeam = seat === declarer || seat === partner;
        return declarerTeam === contractSucceeded ? amount : -amount;
      }) as [number, number, number, number]);

  return {
    status: 'scored',
    contractSucceeded,
    declarerTeamTricks,
    pointValue,
    deltas,
  };
}

export function scoreOrdinaryContract(
  bid: NumericalBid,
  declarer: Seat,
  partner: Seat | null,
  trickCounts: readonly [number, number, number, number],
): OrdinaryScore {
  if (bid.bidType !== 'ordinary') {
    throw new Error('scoreOrdinaryContract only accepts an ordinary bid.');
  }
  return scoreNumericalContract(bid, declarer, partner, trickCounts);
}
