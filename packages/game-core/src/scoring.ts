import type { NumericalBid } from './bidding';
import { SEATS, type Seat } from './deal';

export type ScoreDeltas = readonly [number, number, number, number];

export interface ScoredNumericalContract {
  readonly status: 'scored';
  readonly contractSucceeded: boolean;
  readonly declarerTeamTricks: number;
  readonly pointValue: number;
  readonly deltas: ScoreDeltas;
}

export interface PendingSelfPartnerScore {
  readonly status: 'pending-self-partner-rule';
  readonly declarerTeamTricks: number;
}

export type NumericalScore = ScoredNumericalContract | PendingSelfPartnerScore;
export type OrdinaryScore = NumericalScore;

export function scoreNumericalContract(
  bid: NumericalBid,
  declarer: Seat,
  partner: Seat | null,
  trickCounts: readonly [number, number, number, number],
): NumericalScore {
  if (bid.bidType !== 'ordinary' && bid.bidType !== 'good') {
    throw new Error('Only ordinary and good scoring are implemented.');
  }

  const declarerTeamTricks =
    trickCounts[declarer] + (partner === null ? 0 : trickCounts[partner]);

  if (partner === null) {
    return { status: 'pending-self-partner-rule', declarerTeamTricks };
  }

  const contractMultiplier = bid.bidType === 'good' ? 2 : 1;
  const pointValue = contractMultiplier * 2 ** (bid.level - 7);
  const contractSucceeded = declarerTeamTricks >= bid.level;
  const amount = contractSucceeded
    ? pointValue * (declarerTeamTricks - 6)
    : pointValue * (bid.level - declarerTeamTricks + 1);
  const declarerTeam = new Set<Seat>([declarer, partner]);
  const deltas = SEATS.map((seat) =>
    declarerTeam.has(seat) === contractSucceeded ? amount : -amount,
  ) as [number, number, number, number];

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
