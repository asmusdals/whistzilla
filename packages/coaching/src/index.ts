import type { GameCommand, PlayerView, Suit } from '@whistzilla/game-core';
import {
  analyzeStrategy,
  type PerspectiveKnowledge,
  type StrategyDecision,
  type StrategyProfile,
} from '@whistzilla/strategy';

export type AssistanceLevel = 'none' | 'hint' | 'guided' | 'training';

export interface CoachingFact {
  readonly kind: 'visible-now' | 'remembered' | 'inferred';
  readonly text: string;
}

export interface CoachingReport {
  readonly revision: number;
  readonly level: AssistanceLevel;
  readonly prompt: string;
  readonly recommended: StrategyDecision | null;
  readonly alternatives: readonly StrategyDecision[];
  readonly candidates: readonly StrategyDecision[];
  readonly facts: readonly CoachingFact[];
  readonly knowledge: PerspectiveKnowledge;
}

function visibleFacts(
  view: PlayerView,
  knowledge: PerspectiveKnowledge,
): readonly CoachingFact[] {
  const facts: CoachingFact[] = [
    {
      kind: 'visible-now',
      text: `${view.legalCommands.length} lovlige handlinger i denne situation`,
    },
  ];
  if (knowledge.playedCardIds.length > 0) {
    facts.push({
      kind: 'remembered',
      text: `${knowledge.playedCardIds.length} kort er spillet og kan huskes`,
    });
  }
  const voidFacts = Object.entries(knowledge.voidSuitsBySeat).flatMap(
    ([seat, suits]) =>
      suits.map((suit: Suit) => ({
        kind: 'inferred' as const,
        text: `Spiller ${Number(seat) + 1} er sikkert renonce i ${suit}`,
      })),
  );
  return [...facts, ...voidFacts];
}

export function createCoachingReport(
  view: PlayerView,
  level: AssistanceLevel = 'hint',
  profile: StrategyProfile = 'advanced',
): CoachingReport {
  const analysis = analyzeStrategy(view, profile);
  const prompt =
    analysis.recommended?.reasons[0]?.text ??
    'Der er ingen beslutning at analysere lige nu.';
  return {
    revision: view.revision,
    level,
    prompt,
    recommended: level === 'none' ? null : analysis.recommended,
    alternatives: level === 'training' ? analysis.candidates.slice(1, 4) : [],
    candidates: analysis.candidates,
    facts: visibleFacts(view, analysis.knowledge),
    knowledge: analysis.knowledge,
  };
}

export interface DecisionComparison {
  readonly played: GameCommand;
  readonly preferred: GameCommand | null;
  readonly matchedRecommendation: boolean;
  readonly scoreDifference: number | null;
}

export function compareDecision(
  report: CoachingReport,
  played: GameCommand,
): DecisionComparison {
  const candidate = report.candidates.find(
    (decision) => JSON.stringify(decision.command) === JSON.stringify(played),
  );
  return {
    played,
    preferred: report.recommended?.command ?? null,
    matchedRecommendation:
      report.recommended !== null &&
      JSON.stringify(report.recommended.command) === JSON.stringify(played),
    scoreDifference:
      report.recommended && candidate
        ? report.recommended.score - candidate.score
        : null,
  };
}
