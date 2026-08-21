import {
  applyCommand,
  createGame,
  projectPlayerView,
  type GameCommand,
} from '@whistzilla/game-core';
import { describe, expect, it } from 'vitest';

import { compareDecision, createCoachingReport } from './index';

describe('coaching reports', () => {
  it('progressively exposes advice from a PlayerView', () => {
    const view = projectPlayerView(
      createGame({ seed: 44, dealer: 3, host: 0 }),
      0,
    );
    const hint = createCoachingReport(view, 'hint');
    const training = createCoachingReport(view, 'training');

    expect(hint.recommended?.command).toEqual(training.recommended?.command);
    expect(hint.alternatives).toHaveLength(0);
    expect(training.alternatives.length).toBeGreaterThan(0);
    expect(training.candidates).toHaveLength(view.legalCommands.length);
    expect(training.facts[0]?.kind).toBe('visible-now');
  });

  it('compares a move against the pre-action report', () => {
    const state = createGame({ seed: 91, dealer: 3, host: 0 });
    const view = projectPlayerView(state, 0);
    const report = createCoachingReport(view, 'training');
    const command = report.recommended?.command as GameCommand;
    const result = applyCommand(state, command);

    expect(result.ok).toBe(true);
    expect(compareDecision(report, command).matchedRecommendation).toBe(true);
  });
});
