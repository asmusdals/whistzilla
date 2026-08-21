import {
  RANKS,
  SUITS,
  type Card,
  type CardId,
  type GameCommand,
  type PlayerView,
  type PlayCardCommand,
  type Seat,
  type Suit,
} from '@whistzilla/game-core';

export type StrategyProfile =
  'legality' | 'beginner' | 'practical' | 'intermediate' | 'advanced';

export type StrategyReasonCode =
  | 'legal-fallback'
  | 'conservative-pass'
  | 'supported-opening'
  | 'strongest-trump'
  | 'supported-partner-call'
  | 'long-suit-lead'
  | 'preserve-trump'
  | 'cheapest-winner'
  | 'cheap-discard'
  | 'visible-void-pressure';

export interface StrategyReason {
  readonly code: StrategyReasonCode;
  readonly text: string;
}

export interface StrategyDecision {
  readonly command: GameCommand;
  readonly score: number;
  readonly reasons: readonly StrategyReason[];
}

export interface PerspectiveKnowledge {
  readonly playedCardIds: readonly CardId[];
  readonly unseenCardCountBySuit: Readonly<Record<Suit, number>>;
  readonly voidSuitsBySeat: Readonly<Record<Seat, readonly Suit[]>>;
}

export interface StrategyAnalysis {
  readonly recommended: StrategyDecision | null;
  readonly candidates: readonly StrategyDecision[];
  readonly knowledge: PerspectiveKnowledge;
}

interface PlayDecision extends StrategyDecision {
  readonly command: PlayCardCommand;
}

const reason = (code: StrategyReasonCode, text: string): StrategyReason => ({
  code,
  text,
});
const rankValue = (card: Card): number =>
  card.kind === 'joker' ? 14 + card.number : RANKS.indexOf(card.rank) + 2;

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined)
    throw new Error('Expected a non-empty candidate list.');
  return item;
}

function commandCard(view: PlayerView, command: PlayCardCommand): Card {
  const card = view.ownHand.find(({ id }) => id === command.cardId);
  if (!card)
    throw new Error('A legal play command must reference the own hand.');
  return card;
}

function winningCard(
  cards: readonly { readonly seat: Seat; readonly card: Card }[],
  trump: Suit | null,
): Card | null {
  const lead = cards[0]?.card;
  if (!lead) return null;
  return cards.reduce((winner, play) => {
    const candidate = play.card;
    if (candidate.kind === 'joker') return candidate;
    if (winner.kind === 'joker') return winner;
    if (candidate.suit === trump && winner.suit !== trump) return candidate;
    if (candidate.suit !== winner.suit) return winner;
    return rankValue(candidate) > rankValue(winner) ? candidate : winner;
  }, lead);
}

export function buildPerspectiveKnowledge(
  view: PlayerView,
): PerspectiveKnowledge {
  const played = view.publicEvents.filter(
    (event): event is Extract<typeof event, { type: 'card-played' }> =>
      event.type === 'card-played',
  );
  const voidSets: Record<Seat, Set<Suit>> = {
    0: new Set(),
    1: new Set(),
    2: new Set(),
    3: new Set(),
  };

  for (let index = 0; index < played.length; index += 4) {
    const trick = played.slice(index, index + 4);
    const lead = trick[0]?.card;
    if (lead?.kind !== 'suited') continue;
    for (const play of trick.slice(1)) {
      if (play.card.kind === 'suited' && play.card.suit !== lead.suit) {
        voidSets[play.seat].add(lead.suit);
      }
    }
  }

  const known = new Set([
    ...view.ownHand.map(({ id }) => id),
    ...played.map(({ card }) => card.id),
  ]);
  const unseenCardCountBySuit = Object.fromEntries(
    SUITS.map((suit) => [
      suit,
      RANKS.filter((rank) => !known.has(`${suit}:${rank}` as CardId)).length,
    ]),
  ) as Record<Suit, number>;

  return {
    playedCardIds: played.map(({ card }) => card.id),
    unseenCardCountBySuit,
    voidSuitsBySeat: {
      0: [...voidSets[0]],
      1: [...voidSets[1]],
      2: [...voidSets[2]],
      3: [...voidSets[3]],
    },
  };
}

function scorePlay(
  view: PlayerView,
  command: PlayCardCommand,
  profile: StrategyProfile,
  knowledge: PerspectiveKnowledge,
): PlayDecision {
  const card = commandCard(view, command);
  const value = rankValue(card);

  if (profile === 'beginner') {
    return {
      command,
      score: 30 - value,
      reasons: [reason('cheap-discard', 'spiller et lavt lovligt kort')],
    };
  }

  const currentWinner = winningCard(view.currentTrick, view.trump);
  const withCandidate = winningCard(
    [...view.currentTrick, { seat: view.viewer, card }],
    view.trump,
  );
  const takesLead = currentWinner !== withCandidate;

  if (view.currentTrick.length === 0) {
    const suitLength =
      card.kind === 'suited'
        ? view.ownHand.filter(
            (held) => held.kind === 'suited' && held.suit === card.suit,
          ).length
        : 0;
    const trumpCost =
      card.kind === 'suited' && card.suit === view.trump ? 8 : 0;
    const visibleVoidPressure =
      profile === 'advanced' && card.kind === 'suited'
        ? ([0, 1, 2, 3] as Seat[]).filter(
            (seat) =>
              seat !== view.viewer &&
              knowledge.voidSuitsBySeat[seat].includes(card.suit),
          ).length * 3
        : 0;
    return {
      command,
      score: suitLength * 10 - value - trumpCost + visibleVoidPressure,
      reasons: [
        reason(
          'long-suit-lead',
          suitLength >= 4 ? 'fører fra en lang farve' : 'bevarer høje kort',
        ),
        ...(trumpCost
          ? [reason('preserve-trump', 'undgår at bruge trumf uden pres')]
          : []),
        ...(visibleVoidPressure
          ? [
              reason(
                'visible-void-pressure',
                'bruger en sikkert observeret renonce i vurderingen',
              ),
            ]
          : []),
      ],
    };
  }

  return takesLead
    ? {
        command,
        score: 100 - value,
        reasons: [
          reason(
            'cheapest-winner',
            'tager føringen med det billigste tilstrækkelige kort',
          ),
        ],
      }
    : {
        command,
        score: 40 - value,
        reasons: [
          reason(
            'cheap-discard',
            'afgiver det billigste kort, når stikket ikke kan overtages',
          ),
        ],
      };
}

function suitStrength(hand: readonly Card[], suit: Suit): number {
  return hand.reduce((score, card) => {
    if (card.kind !== 'suited' || card.suit !== suit) return score;
    return score + Math.max(1, rankValue(card) - 9);
  }, 0);
}

function scoreNonPlay(
  view: PlayerView,
  command: GameCommand,
): StrategyDecision {
  if (command.type === 'pass') {
    return {
      command,
      score: 1_000,
      reasons: [
        reason('conservative-pass', 'undgår at overbyde uden en stærk hånd'),
      ],
    };
  }
  if (command.type === 'place-bid') {
    const supported =
      command.bid.kind === 'numerical' &&
      command.bid.level === 7 &&
      (command.bid.bidType === 'ordinary' || command.bid.bidType === 'good');
    return {
      command,
      score: supported ? 100 : -100,
      reasons: [
        reason(
          supported ? 'supported-opening' : 'legal-fallback',
          supported
            ? 'åbner med den laveste understøttede kontrakt'
            : 'kontrakten er lovlig, men ikke del af den nuværende MVP',
        ),
      ],
    };
  }
  if (command.type === 'choose-trump') {
    return {
      command,
      score: suitStrength(view.ownHand, command.trump),
      reasons: [
        reason('strongest-trump', 'vurderer længde og honnører i farven'),
      ],
    };
  }
  if (command.type === 'call-partner') {
    const suit = command.cardId.split(':')[0] as Suit;
    return {
      command,
      score: suitStrength(view.ownHand, suit),
      reasons: [
        reason(
          'supported-partner-call',
          'kalder i en farve med praktisk støtte',
        ),
      ],
    };
  }
  return {
    command,
    score: 0,
    reasons: [reason('legal-fallback', 'vælger en lovlig handling')],
  };
}

function sortCandidates(
  candidates: readonly StrategyDecision[],
): readonly StrategyDecision[] {
  return [...candidates].sort(
    (left, right) =>
      right.score - left.score ||
      JSON.stringify(left.command).localeCompare(JSON.stringify(right.command)),
  );
}

export function analyzeStrategy(
  view: PlayerView,
  profile: StrategyProfile = 'practical',
): StrategyAnalysis {
  const knowledge = buildPerspectiveKnowledge(view);
  if (view.legalCommands.length === 0) {
    return { recommended: null, candidates: [], knowledge };
  }
  if (profile === 'legality') {
    const candidates = view.legalCommands.map((command) => ({
      command,
      score: 0,
      reasons: [reason('legal-fallback', 'vælger en lovlig handling')],
    }));
    return { recommended: first(candidates), candidates, knowledge };
  }

  const effectiveProfile = profile === 'practical' ? 'intermediate' : profile;
  const candidates = sortCandidates(
    view.legalCommands.map((command) =>
      command.type === 'play-card'
        ? scorePlay(view, command, effectiveProfile, knowledge)
        : scoreNonPlay(view, command),
    ),
  );
  return { recommended: first(candidates), candidates, knowledge };
}

export function chooseStrategyAction(
  view: PlayerView,
  profile: StrategyProfile = 'practical',
): StrategyDecision | null {
  return analyzeStrategy(view, profile).recommended;
}
