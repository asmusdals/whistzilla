import {
  applyCommand,
  createGame,
  projectPlayerView,
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

    for (const seat of [1, 2, 3] as const) {
      const view = projectPlayerView(state, seat);
      const decision = chooseStrategyAction(view);
      expect(view.legalCommands).toContainEqual(decision?.command);
      state = advanceWithStrategy(state, seat);
    }
  });

  it('can play a complete game using only projected player views', () => {
    let state = createGame({ seed: 1234, dealer: 3, host: 0 });
    let decisions = 0;

    while (state.phase !== 'scoring') {
      const actor =
        state.phase === 'bidding'
          ? state.bidding.actor
          : state.phase === 'trick-play'
            ? state.trickPlay.actor
            : state.declarer;
      if (actor === null) throw new Error('Expected an actor.');
      state = advanceWithStrategy(state, actor);
      decisions += 1;
      if (decisions > 80) throw new Error('Strategy did not finish the game.');
    }

    expect(state.trickPlay.completedTricks).toHaveLength(13);
    expect(decisions).toBeGreaterThan(50);
  });

  it('ranks every legal candidate and remembers only public card play', () => {
    let state = createGame({ seed: 87, dealer: 3, host: 0 });

    while (
      state.phase !== 'trick-play' ||
      state.trickPlay.completedTricks.length < 2
    ) {
      const actor =
        state.phase === 'bidding'
          ? state.bidding.actor
          : state.phase === 'trick-play'
            ? state.trickPlay.actor
            : state.declarer;
      if (actor === null) throw new Error('Expected an actor.');
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
});
