import { describe, expect, it } from 'vitest';

import type { ReplayRecord } from './replay';
import { replayGame } from './replay';

describe('game replay', () => {
  it('reconstructs the exact state from seed and accepted commands', () => {
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
        { type: 'pass', actor: 1, expectedRevision: 1 },
        { type: 'pass', actor: 2, expectedRevision: 2 },
        { type: 'pass', actor: 3, expectedRevision: 3 },
      ],
    };

    expect(replayGame(record)).toEqual(replayGame(record));
    expect(replayGame(record).declarer).toBe(0);
  });

  it('rejects an invalid command log', () => {
    expect(() =>
      replayGame({
        schemaVersion: 1,
        config: { seed: 42, dealer: 3, host: 0 },
        commands: [{ type: 'pass', actor: 0, expectedRevision: 0 }],
      }),
    ).toThrow('opening-pass-forbidden');
  });
});
