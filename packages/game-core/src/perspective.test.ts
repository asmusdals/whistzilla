import { describe, expect, it } from 'vitest';

import { createGame } from './game';
import { projectPlayerView } from './perspective';

describe('player perspective', () => {
  it('contains the viewer hand but no seed, kitty cards, or opponent cards', () => {
    const state = createGame({ seed: 987_654, dealer: 3, host: 0 });
    const view = projectPlayerView(state, 0);
    const serialized = JSON.stringify(view);
    const hiddenIds = [
      ...state.hands[1],
      ...state.hands[2],
      ...state.hands[3],
      ...state.kitty,
    ].map(({ id }) => id);

    expect(view.ownHand).toEqual(state.hands[0]);
    expect(serialized).not.toContain('987654');
    expect(hiddenIds.every((id) => !serialized.includes(id))).toBe(true);
    expect(view.opponents.map(({ cardCount }) => cardCount)).toEqual([
      13, 13, 13,
    ]);
    expect(view.kittyCardCount).toBe(3);
  });

  it('is invariant when hidden cards are rearranged', () => {
    const state = createGame({ seed: 10, dealer: 3, host: 0 });
    const changedState = {
      ...state,
      hands: [
        state.hands[0],
        state.hands[2],
        state.hands[3],
        state.hands[1],
      ] as const,
      kitty: [...state.kitty].reverse(),
    };

    expect(projectPlayerView(changedState, 0)).toEqual(
      projectPlayerView(state, 0),
    );
  });
});
