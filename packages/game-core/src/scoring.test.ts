import { describe, expect, it } from 'vitest';

import {
  scoreNumericalContract,
  scoreOrdinaryContract,
  scoreSpecialContract,
} from './scoring';

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

  it('uses the provisional self-partner distribution when no partner is resolved', () => {
    expect(
      scoreOrdinaryContract(
        { kind: 'numerical', level: 7, bidType: 'ordinary' },
        0,
        null,
        [8, 2, 2, 1],
      ),
    ).toEqual({
      status: 'scored',
      contractSucceeded: true,
      declarerTeamTricks: 8,
      pointValue: 1,
      deltas: [6, -2, -2, -2],
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

describe('halves and provisional self-partner scoring', () => {
  it('uses the doubled point table for halves', () => {
    expect(
      scoreNumericalContract(
        { kind: 'numerical', level: 8, bidType: 'halves' },
        0,
        2,
        [4, 2, 4, 3],
      ),
    ).toMatchObject({
      status: 'scored',
      contractSucceeded: true,
      pointValue: 4,
      deltas: [8, -8, 8, -8],
    });
  });

  it('applies the isolated provisional three-against-one distribution', () => {
    expect(
      scoreNumericalContract(
        { kind: 'numerical', level: 7, bidType: 'ordinary' },
        0,
        0,
        [8, 2, 2, 1],
      ),
    ).toEqual({
      status: 'scored',
      contractSucceeded: true,
      declarerTeamTricks: 8,
      pointValue: 1,
      deltas: [6, -2, -2, -2],
    });
  });
});

describe('vip scoring', () => {
  it.each([
    [1, 3],
    [2, 4],
    [3, 6],
  ] as const)('uses the %i. Vip base value', (revealCount, pointValue) => {
    expect(
      scoreNumericalContract(
        { kind: 'numerical', level: 7, bidType: 'vip' },
        0,
        2,
        [4, 2, 4, 3],
        revealCount,
      ),
    ).toMatchObject({ status: 'scored', pointValue });
  });
});

describe('provisional special-contract scoring', () => {
  it.each([
    ['sol', 16],
    ['pure-sol', 32],
    ['open-laydown', 64],
    ['super-laydown', 128],
  ] as const)('scores a won %s one against three', (bidType, pointValue) => {
    expect(
      scoreSpecialContract({ kind: 'special', bidType }, 0, [
        bidType === 'sol' ? 1 : 0,
        5,
        4,
        bidType === 'sol' ? 3 : 4,
      ]),
    ).toEqual({
      status: 'scored',
      contractSucceeded: true,
      declarerTricks: bidType === 'sol' ? 1 : 0,
      pointValue,
      deltas: [pointValue * 3, -pointValue, -pointValue, -pointValue],
    });
  });

  it('applies the isolated opposite-sign policy when a special is lost', () => {
    expect(
      scoreSpecialContract(
        { kind: 'special', bidType: 'pure-sol' },
        0,
        [1, 4, 4, 4],
      ).deltas,
    ).toEqual([-96, 32, 32, 32]);
  });
});
