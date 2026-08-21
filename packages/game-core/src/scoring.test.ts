import { describe, expect, it } from 'vitest';

import { scoreNumericalContract, scoreOrdinaryContract } from './scoring';

describe('ordinary contract scoring', () => {
  it('awards every player on a successful declarer team', () => {
    expect(
      scoreOrdinaryContract(
        { kind: 'numerical', level: 9, bidType: 'ordinary' },
        0,
        2,
        [5, 2, 5, 1],
      ),
    ).toEqual({
      status: 'scored',
      contractSucceeded: true,
      declarerTeamTricks: 10,
      pointValue: 4,
      deltas: [16, -16, 16, -16],
    });
  });

  it('charges missing tricks plus one when the contract fails', () => {
    expect(
      scoreOrdinaryContract(
        { kind: 'numerical', level: 9, bidType: 'ordinary' },
        1,
        3,
        [4, 3, 3, 3],
      ),
    ).toEqual({
      status: 'scored',
      contractSucceeded: false,
      declarerTeamTricks: 6,
      pointValue: 4,
      deltas: [16, -16, 16, -16],
    });
  });

  it('does not guess the unresolved self-partner distribution', () => {
    expect(
      scoreOrdinaryContract(
        { kind: 'numerical', level: 7, bidType: 'ordinary' },
        0,
        null,
        [8, 2, 2, 1],
      ),
    ).toEqual({
      status: 'pending-self-partner-rule',
      declarerTeamTricks: 8,
    });
  });
});

describe('good contract scoring', () => {
  it('uses twice the ordinary point value', () => {
    expect(
      scoreNumericalContract(
        { kind: 'numerical', level: 9, bidType: 'good' },
        0,
        2,
        [5, 2, 5, 1],
      ),
    ).toEqual({
      status: 'scored',
      contractSucceeded: true,
      declarerTeamTricks: 10,
      pointValue: 8,
      deltas: [32, -32, 32, -32],
    });
  });
});
