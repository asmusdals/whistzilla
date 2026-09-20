import 'fake-indexeddb/auto';
import { replayGame, type ReplayRecord } from '@whistzilla/game-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  archiveCompletedGame,
  clearActiveGame,
  EMPTY_MATCH_PROGRESS,
  listCompletedGames,
  loadActiveGame,
  loadMatchProgress,
  resetGameStorage,
  saveActiveGame,
  saveMatchProgress,
} from './gameStorage';

const record: ReplayRecord = {
  schemaVersion: 1,
  config: { seed: 42, dealer: 3, host: 0 },
  commands: [
    {
      type: 'place-bid',
      actor: 0,
      expectedRevision: 0,
      bid: { kind: 'numerical', level: 7, bidType: 'ordinary' },
    },
  ],
};

afterEach(async () => resetGameStorage());

describe('game storage', () => {
  it('round-trips a validated active replay', async () => {
    await saveActiveGame(record);
    const loaded = await loadActiveGame();

    expect(loaded).toEqual(record);
    expect(loaded && replayGame(loaded)).toEqual(replayGame(record));
  });

  it('loads legacy exchange commands without preserving a kitty choice', async () => {
    const legacy = {
      ...record,
      commands: [
        ...record.commands,
        {
          type: 'exchange-cards',
          actor: 0,
          expectedRevision: 1,
          discardedCardIds: ['clubs:two'],
          kittyCardIds: ['joker:1'],
        },
      ],
    } as unknown as ReplayRecord;

    await saveActiveGame(legacy);
    const loaded = await loadActiveGame();
    expect(loaded?.commands.at(-1)).toEqual({
      type: 'exchange-cards',
      actor: 0,
      expectedRevision: 1,
      discardedCardIds: ['clubs:two'],
    });
  });

  it('clears the active game', async () => {
    await saveActiveGame(record);
    await clearActiveGame();

    expect(await loadActiveGame()).toBeNull();
  });

  it('persists cumulative scores and the next dealer separately from replay', async () => {
    expect(await loadMatchProgress()).toEqual(EMPTY_MATCH_PROGRESS);
    const progress = {
      scores: [6, -2, -2, -2] as const,
      rounds: 1,
      nextDealer: 0 as const,
      lastScoredSeed: 42,
    };

    await saveMatchProgress(progress);
    expect(await loadMatchProgress()).toEqual(progress);
    expect(await loadActiveGame()).toBeNull();
  });

  it('archives completed games idempotently by seed', async () => {
    await archiveCompletedGame(record);
    await archiveCompletedGame(record);

    const completed = await listCompletedGames();
    expect(completed).toHaveLength(1);
    expect(completed[0]?.record).toEqual(record);
  });

  it('rejects malformed stored records', async () => {
    await expect(
      saveActiveGame({
        ...record,
        schemaVersion: 2,
      } as unknown as ReplayRecord),
    ).rejects.toThrow();
  });
});
