import {
  applyCommand,
  bidRank,
  createGame,
  projectPlayerView,
  type Bid,
  type GameState,
} from '@whistzilla/game-core';
import { describe, expect, it } from 'vitest';

import { chooseStrategyAction, type StrategyProfile } from './index';

interface AuctionSummary {
  readonly games: number;
  readonly medianRank: number;
  readonly meanRank: number;
  readonly levels: Record<string, number>;
  readonly specialTypes: Record<string, number>;
  readonly medianRaises: number;
  readonly sevenOrEight: number;
  readonly nineOrTen: number;
  readonly aboveTen: number;
}

function advance(
  state: GameState,
  command: Parameters<typeof applyCommand>[1],
) {
  const result = applyCommand(state, command);
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}

function measureAuctions(
  profile: StrategyProfile,
  seeds: number,
  humanOpening = false,
): AuctionSummary {
  const ranks: number[] = [];
  const raises: number[] = [];
  const levels: Record<string, number> = {};
  const specialTypes: Record<string, number> = {};
  let sevenOrEight = 0;
  let nineOrTen = 0;
  let aboveTen = 0;

  for (let seed = 0; seed < seeds; seed += 1) {
    let state = createGame({ seed, dealer: 3, host: 0 });
    if (humanOpening) {
      const opening = projectPlayerView(state, 0).legalCommands.find(
        (command) =>
          command.type === 'place-bid' &&
          command.bid.kind === 'numerical' &&
          command.bid.level === 7 &&
          command.bid.bidType === 'ordinary',
      );
      if (!opening) throw new Error('Expected opening.');
      state = advance(state, opening);
    }
    let count = Number(humanOpening);
    while (state.phase === 'bidding') {
      const view = projectPlayerView(state, state.bidding.actor);
      const chosen = chooseStrategyAction(view, profile)?.command;
      if (!chosen) throw new Error('Expected bid or pass.');
      count += Number(chosen.type === 'place-bid');
      state = advance(state, chosen);
      if (count > 30) throw new Error('Auction did not end.');
    }
    const bid = state.winningBid as Bid;
    ranks.push(bidRank(bid));
    raises.push(count);
    if (bid.kind === 'numerical') {
      levels[bid.level] = (levels[bid.level] ?? 0) + 1;
      if (bid.level <= 8) sevenOrEight += 1;
      else if (bid.level <= 10) nineOrTen += 1;
      else aboveTen += 1;
    } else {
      specialTypes[bid.bidType] = (specialTypes[bid.bidType] ?? 0) + 1;
    }
  }

  ranks.sort((a, b) => a - b);
  raises.sort((a, b) => a - b);
  return {
    games: seeds,
    medianRank: ranks[Math.floor(seeds / 2)] ?? 0,
    meanRank: ranks.reduce((total, rank) => total + rank, 0) / seeds,
    levels,
    specialTypes,
    medianRaises: raises[Math.floor(seeds / 2)] ?? 0,
    sevenOrEight,
    nineOrTen,
    aboveTen,
  };
}

describe('seeded bidding mix', () => {
  it('keeps 9–10 common, Sol possible, and very high bids rare', () => {
    const beginner = measureAuctions('beginner', 256);
    const intermediate = measureAuctions('intermediate', 256);
    const advanced = measureAuctions('advanced', 256);
    const humanSeven = measureAuctions('intermediate', 256, true);
    if (process.env.WHISTZILLA_EVAL_REPORT === '1')
      console.info({ beginner, intermediate, advanced, humanSeven });
    for (const summary of [beginner, intermediate, advanced, humanSeven]) {
      expect(summary.games).toBe(256);
      expect(
        summary.sevenOrEight +
          summary.nineOrTen +
          summary.aboveTen +
          Object.values(summary.specialTypes).reduce(
            (total, count) => total + count,
            0,
          ),
      ).toBe(summary.games);
      expect(summary.aboveTen).toBeLessThan(summary.games * 0.1);
      expect(summary.specialTypes['super-laydown'] ?? 0).toBeLessThan(3);
    }
    expect(beginner.nineOrTen).toBeGreaterThan(beginner.games * 0.5);
    expect(intermediate.nineOrTen).toBeGreaterThan(intermediate.games * 0.7);
    expect(advanced.nineOrTen).toBeGreaterThan(advanced.games * 0.75);
    expect(humanSeven.nineOrTen).toBeGreaterThan(humanSeven.games * 0.7);
    expect(intermediate.specialTypes.sol ?? 0).toBeGreaterThan(0);
    expect(advanced.specialTypes.sol ?? 0).toBeGreaterThan(0);
    expect(intermediate.medianRaises).toBeGreaterThanOrEqual(2);
    expect(humanSeven.medianRaises).toBeGreaterThanOrEqual(3);
  });
});
