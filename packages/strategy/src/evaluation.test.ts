import {
  applyCommand,
  contractSetupActor,
  createGame,
  projectPlayerView,
  type GameState,
  type Seat,
} from '@whistzilla/game-core';
import { describe, expect, it } from 'vitest';

import { chooseStrategyAction, type StrategyProfile } from './index';

function actor(state: GameState): Seat {
  const current =
    state.phase === 'bidding'
      ? state.bidding.actor
      : state.phase === 'trick-play'
        ? state.trickPlay.actor
        : contractSetupActor(state);
  if (current === null) throw new Error('Expected an active player.');
  return current;
}

function evaluate(
  challenger: StrategyProfile,
  opponents: StrategyProfile,
  seeds: number,
  forcedOrdinary = false,
  seedStart = 0,
) {
  let points = 0;
  let positiveRounds = 0;
  let turns = 0;
  let numerical = 0;
  let specials = 0;
  let challengerDeclared = 0;
  let challengerDeclaredSucceeded = 0;
  let totalLevel = 0;
  let successfulNumerical = 0;
  const bidTypes: Record<string, number> = {};
  let pointsAsDeclarer = 0;
  let pointsAsDefender = 0;
  let actualTeamTricks = 0;
  const byLevel: Record<
    string,
    { games: number; succeeded: number; teamTricks: number }
  > = {};
  const byBidType: Record<
    string,
    { games: number; succeeded: number; teamTricks: number }
  > = {};
  for (let seed = seedStart; seed < seedStart + seeds; seed += 1) {
    for (const seat of [0, 1, 2, 3] as const) {
      let state = createGame({ seed, dealer: 3, host: 0 });
      if (forcedOrdinary) {
        const opening = projectPlayerView(state, 0).legalCommands.find(
          (command) =>
            command.type === 'place-bid' &&
            command.bid.kind === 'numerical' &&
            command.bid.level === 7 &&
            command.bid.bidType === 'ordinary',
        );
        if (!opening) throw new Error('Expected opening bid.');
        const result = applyCommand(state, opening);
        if (!result.ok) throw new Error(result.error.code);
        state = result.state;
        while (state.phase === 'bidding') {
          const pass = projectPlayerView(
            state,
            state.bidding.actor,
          ).legalCommands.find((command) => command.type === 'pass');
          if (!pass) throw new Error('Expected legal pass.');
          const next = applyCommand(state, pass);
          if (!next.ok) throw new Error(next.error.code);
          state = next.state;
        }
      }
      let decisions = 0;
      while (state.phase !== 'scoring') {
        const activeSeat = actor(state);
        const profile = activeSeat === seat ? challenger : opponents;
        const command = chooseStrategyAction(
          projectPlayerView(state, activeSeat),
          profile,
        )?.command;
        if (!command) throw new Error('Expected a strategy decision.');
        const result = applyCommand(state, command);
        if (!result.ok) throw new Error(result.error.code);
        state = result.state;
        decisions += 1;
        if (decisions > 180) throw new Error('Game did not finish.');
      }
      const delta = state.score?.deltas[seat] ?? 0;
      numerical += Number(state.winningBid?.kind === 'numerical');
      specials += Number(state.winningBid?.kind === 'special');
      challengerDeclared += Number(state.declarer === seat);
      challengerDeclaredSucceeded += Number(
        state.declarer === seat && state.score?.contractSucceeded,
      );
      if (state.winningBid?.kind === 'numerical') {
        totalLevel += state.winningBid.level;
        successfulNumerical += Number(state.score?.contractSucceeded);
        const level = String(state.winningBid.level);
        const levelSummary = (byLevel[level] ??= {
          games: 0,
          succeeded: 0,
          teamTricks: 0,
        });
        levelSummary.games += 1;
        levelSummary.succeeded += Number(state.score?.contractSucceeded);
        const typeSummary = (byBidType[state.winningBid.bidType] ??= {
          games: 0,
          succeeded: 0,
          teamTricks: 0,
        });
        typeSummary.games += 1;
        typeSummary.succeeded += Number(state.score?.contractSucceeded);
        if (state.score && 'declarerTeamTricks' in state.score) {
          actualTeamTricks += state.score.declarerTeamTricks;
          levelSummary.teamTricks += state.score.declarerTeamTricks;
          typeSummary.teamTricks += state.score.declarerTeamTricks;
        }
        bidTypes[state.winningBid.bidType] =
          (bidTypes[state.winningBid.bidType] ?? 0) + 1;
      }
      if (state.declarer === seat) pointsAsDeclarer += delta;
      else pointsAsDefender += delta;
      points += delta;
      positiveRounds += Number(delta > 0);
      turns += decisions;
    }
  }
  return {
    games: seeds * 4,
    meanPoints: points / (seeds * 4),
    positiveRoundRate: positiveRounds / (seeds * 4),
    meanDecisions: turns / (seeds * 4),
    numerical,
    specials,
    challengerDeclared,
    challengerDeclaredSucceeded,
    meanLevel: totalLevel / Math.max(1, numerical),
    successfulNumerical,
    bidTypes,
    pointsAsDeclarer,
    pointsAsDefender,
    meanTeamTricks: actualTeamTricks / Math.max(1, numerical),
    byLevel,
    byBidType,
  };
}

describe('rotated seeded bot evaluation', () => {
  it(
    'measures the three difficulty levels without using human replays',
    () => {
      const seeds = process.env.WHISTZILLA_EVAL_REPORT === '1' ? 128 : 32;
      const seedStart = Number(process.env.WHISTZILLA_EVAL_SEED_START ?? 0);
      const intermediate = evaluate(
        'intermediate',
        'beginner',
        seeds,
        false,
        seedStart,
      );
      const advanced = evaluate(
        'advanced',
        'intermediate',
        seeds,
        false,
        seedStart,
      );
      const fixedContract = evaluate(
        'advanced',
        'intermediate',
        seeds,
        true,
        seedStart,
      );
      if (process.env.WHISTZILLA_EVAL_REPORT === '1')
        console.info(JSON.stringify({ intermediate, advanced, fixedContract }));
      expect(intermediate.games).toBe(seeds * 4);
      expect(advanced.games).toBe(seeds * 4);
      expect(intermediate.meanPoints).toBeGreaterThan(0);
      expect(advanced.meanPoints).toBeGreaterThan(0);
      expect(advanced.numerical).toBeGreaterThan(seeds * 3.5);
      expect(advanced.meanLevel).toBeGreaterThan(8.5);
      expect(advanced.meanLevel).toBeLessThan(10.5);
      expect(
        intermediate.successfulNumerical / intermediate.numerical,
      ).toBeGreaterThan(0.42);
      expect(advanced.successfulNumerical / advanced.numerical).toBeGreaterThan(
        0.34,
      );
      expect(advanced.positiveRoundRate).toBeGreaterThan(0.55);
      expect(fixedContract.meanPoints).toBeGreaterThan(0);
    },
    process.env.WHISTZILLA_EVAL_REPORT === '1' ? 180_000 : 60_000,
  );
});
