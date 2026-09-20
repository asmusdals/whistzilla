import type { Seat } from './deal';

export const NUMERICAL_LEVELS = [7, 8, 9, 10, 11, 12, 13] as const;
export type NumericalLevel = (typeof NUMERICAL_LEVELS)[number];

export const NUMERICAL_BID_TYPES = [
  'ordinary',
  'halves',
  'good',
  'vip',
] as const;
export type NumericalBidType = (typeof NUMERICAL_BID_TYPES)[number];

export const SPECIAL_BID_TYPES = [
  'sol',
  'pure-sol',
  'open-laydown',
  'super-laydown',
] as const;
export type SpecialBidType = (typeof SPECIAL_BID_TYPES)[number];

export interface NumericalBid {
  readonly kind: 'numerical';
  readonly level: NumericalLevel;
  readonly bidType: NumericalBidType;
}

export interface SpecialBid {
  readonly kind: 'special';
  readonly bidType: SpecialBidType;
}

export type Bid = NumericalBid | SpecialBid;

export interface BiddingState {
  readonly actor: Seat;
  readonly currentBid: Bid | null;
  readonly bidHolder: Seat | null;
  readonly passedSeats: readonly Seat[];
}

const numericalBids = NUMERICAL_LEVELS.flatMap((level) =>
  NUMERICAL_BID_TYPES.map((bidType): NumericalBid => ({
    kind: 'numerical',
    level,
    bidType,
  })),
);

const specialBids = SPECIAL_BID_TYPES.map((bidType): SpecialBid => ({
  kind: 'special',
  bidType,
}));

export const ALL_BIDS: readonly Bid[] = Object.freeze(
  [...numericalBids, ...specialBids].sort(compareBids),
);

export function bidRank(bid: Bid): number {
  if (bid.kind === 'numerical') {
    const levelIndex = NUMERICAL_LEVELS.indexOf(bid.level);
    const typeIndex = NUMERICAL_BID_TYPES.indexOf(bid.bidType);
    return (levelIndex * NUMERICAL_BID_TYPES.length + typeIndex) * 2;
  }

  switch (bid.bidType) {
    case 'sol':
      return 19;
    case 'pure-sol':
      return 27;
    case 'open-laydown':
      return 35;
    case 'super-laydown':
      return 100;
  }
}

export function compareBids(left: Bid, right: Bid): number {
  return bidRank(left) - bidRank(right);
}

export function isHigherBid(candidate: Bid, current: Bid): boolean {
  return compareBids(candidate, current) > 0;
}

export function availableBids(current: Bid | null): readonly Bid[] {
  if (!current) {
    return ALL_BIDS;
  }

  return ALL_BIDS.filter((bid) => isHigherBid(bid, current));
}
