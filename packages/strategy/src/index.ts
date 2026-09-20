import {
  RANKS,
  SEATS,
  SUITS,
  createDeck,
  scoreNumericalContract,
  scoreSpecialContract,
  type Bid,
  type Card,
  type CardId,
  type GameCommand,
  type PlayerView,
  type PlayCardCommand,
  type NumericalBid,
  type Rank,
  type Seat,
  type Suit,
} from '@whistzilla/game-core';

export type StrategyProfile =
  'legality' | 'beginner' | 'practical' | 'intermediate' | 'advanced';

export type StrategyReasonCode =
  | 'legal-fallback'
  | 'conservative-pass'
  | 'auction-restraint'
  | 'hand-supported-bid'
  | 'contract-risk'
  | 'strongest-trump'
  | 'supported-partner-call'
  | 'improves-exchange'
  | 'long-suit-lead'
  | 'draw-trump'
  | 'cash-winner'
  | 'preserve-trump'
  | 'support-partner'
  | 'second-hand-low'
  | 'third-hand-high'
  | 'avoid-special-trick'
  | 'pressure-special-declarer'
  | 'open-hand-forcing'
  | 'open-endgame-plan'
  | 'cheapest-winner'
  | 'cheap-discard'
  | 'visible-void-pressure'
  | 'sampled-continuation';

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
  readonly unseenRanksBySuit: Readonly<Record<Suit, readonly Rank[]>>;
  readonly voidSuitsBySeat: Readonly<Record<Seat, readonly Suit[]>>;
}

export interface StrategyAnalysis {
  readonly recommended: StrategyDecision | null;
  readonly candidates: readonly StrategyDecision[];
  readonly knowledge: PerspectiveKnowledge;
}

// The lower levels have less recall of completed tricks. The current trick is
// always visible, even when earlier public play has been forgotten.
const REMEMBERED_TRICKS: Readonly<Record<StrategyProfile, number>> = {
  legality: 0,
  beginner: 0,
  practical: 4,
  intermediate: 4,
  advanced: 13,
};

interface PlayDecision extends StrategyDecision {
  readonly command: PlayCardCommand;
}

const reason = (code: StrategyReasonCode, text: string): StrategyReason => ({
  code,
  text,
});
const rankValue = (card: Card, aceLow = false): number =>
  card.kind === 'joker'
    ? 15 + card.number
    : aceLow && card.rank === 'ace'
      ? 1
      : RANKS.indexOf(card.rank) + 2;

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

function knownTeammates(view: PlayerView): readonly Seat[] {
  if (view.declarer === null) return [];
  if (view.winningBid?.kind === 'special')
    return view.viewer === view.declarer
      ? []
      : SEATS.filter((seat) => seat !== view.viewer && seat !== view.declarer);
  if (view.viewer === view.declarer)
    return view.publicPartner === null ? [] : [view.publicPartner];
  if (view.ownHand.some(({ id }) => id === view.calledPartnerCardId))
    return [view.declarer];
  if (view.publicPartner === null) return [];
  return SEATS.filter(
    (seat) =>
      seat !== view.viewer &&
      seat !== view.declarer &&
      seat !== view.publicPartner,
  );
}

function winningPlay(
  cards: readonly { readonly seat: Seat; readonly card: Card }[],
  trump: Suit | null,
  aceLow: boolean,
): { readonly seat: Seat; readonly card: Card } | null {
  const lead = cards[0];
  if (!lead) return null;
  return cards.reduce((winner, play) => {
    const candidate = play.card;
    if (candidate.kind === 'joker') return winner;
    if (winner.card.kind === 'joker') return winner;
    if (candidate.suit === trump && winner.card.suit !== trump) return play;
    if (candidate.suit !== winner.card.suit) return winner;
    return rankValue(candidate, aceLow) > rankValue(winner.card, aceLow)
      ? play
      : winner;
  }, lead);
}

function visibleLegalCards(
  hand: readonly Card[],
  trick: readonly { readonly seat: Seat; readonly card: Card }[],
  firstTrick: boolean,
): readonly Card[] {
  if (trick.length === 0 && firstTrick)
    return hand.filter(({ kind }) => kind !== 'joker');
  const lead = trick[0]?.card;
  if (!lead || lead.kind === 'joker') return hand;
  const following = hand.filter(
    (card) => card.kind === 'suited' && card.suit === lead.suit,
  );
  return following.length > 0 ? following : hand;
}

type SampledHands = Record<Seat, readonly Card[]>;

function samplePossibleHands(
  view: PlayerView,
  knowledge: PerspectiveKnowledge,
): readonly SampledHands[] {
  const publicCards = view.publicEvents.flatMap((event) =>
    event.type === 'card-played' ? [event.card.id] : [],
  );
  const known = new Set<CardId>([
    ...view.ownHand.map(({ id }) => id),
    ...publicCards,
    ...view.currentTrick.map(({ card }) => card.id),
    ...view.vipRevealedCards.map(({ id }) => id),
    ...view.openHands.flatMap(({ cards }) => cards.map(({ id }) => id)),
  ]);
  const unknown = createDeck().filter(({ id }) => !known.has(id));
  const open = new Map(view.openHands.map(({ seat, cards }) => [seat, cards]));
  const hidden = view.opponents.filter(({ seat }) => !open.has(seat));
  if (
    hidden.reduce((sum, { cardCount }) => sum + cardCount, 0) > unknown.length
  )
    return [];

  // The seed contains only the player's view. Every candidate is evaluated
  // against the same plausible deals, including the unknown kitty/discards.
  let seed = view.revision + view.viewer * 31;
  for (const card of view.ownHand) {
    for (const character of card.id)
      seed = (seed * 33 + character.charCodeAt(0)) >>> 0;
  }
  const nextRandom = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const samples: SampledHands[] = [];
  for (let attempt = 0; attempt < 96 && samples.length < 24; attempt += 1) {
    const remaining = [...unknown];
    for (let index = remaining.length - 1; index > 0; index -= 1) {
      const other = Math.floor(nextRandom() * (index + 1));
      const selected = remaining[index];
      const swapped = remaining[other];
      if (!selected || !swapped) continue;
      remaining[index] = swapped;
      remaining[other] = selected;
    }
    const hands: SampledHands = {
      0: open.get(0) ?? [],
      1: open.get(1) ?? [],
      2: open.get(2) ?? [],
      3: open.get(3) ?? [],
    };
    hands[view.viewer] = view.ownHand;
    let possible = true;
    for (const opponent of [...hidden].sort(
      (left, right) =>
        knowledge.voidSuitsBySeat[right.seat].length -
        knowledge.voidSuitsBySeat[left.seat].length,
    )) {
      const cards: Card[] = [];
      for (let count = 0; count < opponent.cardCount; count += 1) {
        const index = remaining.findIndex(
          (card) =>
            card.kind === 'joker' ||
            !knowledge.voidSuitsBySeat[opponent.seat].includes(card.suit),
        );
        if (index < 0) {
          possible = false;
          break;
        }
        cards.push(...remaining.splice(index, 1));
      }
      if (!possible) break;
      hands[opponent.seat] = cards;
    }
    if (possible) samples.push(hands);
  }
  return samples;
}

function sampledTeam(view: PlayerView, hands: SampledHands): readonly Seat[] {
  if (view.declarer === null) return [view.viewer];
  const calledHolder =
    view.publicPartner ??
    SEATS.find((seat) =>
      hands[seat].some(({ id }) => id === view.calledPartnerCardId),
    );
  const declarerTeam = [view.declarer, calledHolder ?? view.declarer];
  return declarerTeam.includes(view.viewer)
    ? declarerTeam
    : SEATS.filter((seat) => !declarerTeam.includes(seat));
}

function simulatedCard(
  hand: readonly Card[],
  trick: readonly { readonly seat: Seat; readonly card: Card }[],
  actor: Seat,
  declarer: Seat | null,
  publicPartner: Seat | null,
  trump: Suit | null,
  firstTrick: boolean,
  calledCardId: CardId | null,
): Card | null {
  let legal = visibleLegalCards(hand, trick, firstTrick);
  const leadSuit = trick[0]?.card;
  if (leadSuit?.kind === 'suited') {
    const forced = legal.find(({ id }) => id === calledCardId);
    if (forced) legal = [forced];
  }
  if (legal.length === 0) return null;
  const sorted = [...legal].sort((a, b) => rankValue(a) - rankValue(b));
  if (trick.length === 0) {
    const ordinary = sorted.filter(
      (card) => card.kind === 'suited' && card.suit !== trump,
    );
    return [...(ordinary.length ? ordinary : sorted)].at(-1) ?? null;
  }
  const currentWinner = winningPlay(trick, trump, false);
  const ownCalledCard = hand.some(({ id }) => id === calledCardId);
  const currentWinnerKnownAlly =
    currentWinner &&
    (actor === declarer
      ? currentWinner.seat === publicPartner
      : ownCalledCard
        ? currentWinner.seat === declarer
        : publicPartner !== null &&
          currentWinner.seat !== declarer &&
          currentWinner.seat !== publicPartner);
  if (currentWinnerKnownAlly) return first(sorted);
  return (
    sorted.find(
      (card) =>
        winningPlay([...trick, { seat: actor, card }], trump, false)?.seat ===
        actor,
    ) ?? first(sorted)
  );
}

function sampledContinuationValue(
  view: PlayerView,
  candidate: Card,
  sample: SampledHands,
): number {
  const team = sampledTeam(view, sample);
  const hands: SampledHands = {
    0: [...sample[0]],
    1: [...sample[1]],
    2: [...sample[2]],
    3: [...sample[3]],
  };
  hands[view.viewer] = hands[view.viewer].filter(
    ({ id }) => id !== candidate.id,
  );
  let trick = [...view.currentTrick, { seat: view.viewer, card: candidate }];
  let actor = ((view.viewer + 1) % 4) as Seat;
  let publicPartner =
    candidate.id === view.calledPartnerCardId
      ? view.viewer
      : view.publicPartner;
  let value = 0;
  for (let trickOffset = 0; trickOffset < 2; trickOffset += 1) {
    while (trick.length < 4) {
      const card = simulatedCard(
        hands[actor],
        trick,
        actor,
        view.declarer,
        publicPartner,
        view.trump,
        view.completedTrickCount + trickOffset === 0,
        view.calledPartnerCardId,
      );
      if (!card) return value;
      hands[actor] = hands[actor].filter(({ id }) => id !== card.id);
      if (card.id === view.calledPartnerCardId) publicPartner = actor;
      trick.push({ seat: actor, card });
      actor = ((actor + 1) % 4) as Seat;
    }
    const winner = winningPlay(trick, view.trump, false)?.seat;
    if (winner === undefined) return value;
    if (team.includes(winner)) value += trickOffset === 0 ? 1 : 0.65;
    if (SEATS.some((seat) => hands[seat].length === 0)) break;
    actor = winner;
    trick = [];
  }
  return value;
}

function openHandDeclarerWinsCurrentTrick(
  view: PlayerView,
  candidate: Card,
): boolean | null {
  if (
    view.winningBid?.kind !== 'special' ||
    view.openHands.length !== 4 ||
    view.declarer === null
  )
    return null;

  const search = (
    trick: readonly { readonly seat: Seat; readonly card: Card }[],
    actor: Seat,
  ): boolean | null => {
    if (trick.length === 4)
      return winningPlay(trick, null, true)?.seat === view.declarer;
    const hand = view.openHands.find(({ seat }) => seat === actor)?.cards;
    if (!hand) return null;
    const legal = visibleLegalCards(
      hand,
      trick,
      view.completedTrickCount === 0,
    );
    if (legal.length === 0) return null;
    const outcomes = legal.map((card) =>
      search([...trick, { seat: actor, card }], ((actor + 1) % 4) as Seat),
    );
    if (outcomes.some((outcome) => outcome === null)) return null;
    return actor === view.declarer
      ? outcomes.every(Boolean)
      : outcomes.some(Boolean);
  };

  const trick = [...view.currentTrick, { seat: view.viewer, card: candidate }];
  if (trick.length === 4)
    return winningPlay(trick, null, true)?.seat === view.declarer;
  return search(trick, ((view.viewer + 1) % 4) as Seat);
}

function openHandEndgameDeclarerTricks(
  view: PlayerView,
  candidate: Card,
): number | null {
  if (
    view.winningBid?.kind !== 'special' ||
    view.openHands.length !== 4 ||
    view.declarer === null ||
    view.openHands.reduce((sum, { cards }) => sum + cards.length, 0) > 12
  )
    return null;

  const hands = Object.fromEntries(
    view.openHands.map(({ seat, cards }) => [seat, [...cards]]),
  ) as unknown as Record<Seat, readonly Card[]>;
  hands[view.viewer] = hands[view.viewer].filter(
    ({ id }) => id !== candidate.id,
  );
  const memo = new Map<string, number>();

  const search = (
    remainingHands: Readonly<Record<Seat, readonly Card[]>>,
    trick: readonly { readonly seat: Seat; readonly card: Card }[],
    actor: Seat,
    completedOffset: number,
  ): number => {
    let activeTrick = trick;
    let activeActor = actor;
    let immediate = 0;
    if (trick.length === 4) {
      const winner = winningPlay(trick, null, true)?.seat;
      if (winner === undefined) return 0;
      immediate = winner === view.declarer ? 1 : 0;
      activeTrick = [];
      activeActor = winner;
      completedOffset += 1;
    }
    if (SEATS.every((seat) => remainingHands[seat].length === 0))
      return immediate;

    const key = `${activeActor}/${completedOffset}/${activeTrick.map(({ seat, card }) => `${seat}:${card.id}`).join(',')}/${SEATS.map((seat) => remainingHands[seat].map(({ id }) => id).join('.')).join('|')}`;
    const cached = memo.get(key);
    if (cached !== undefined) return immediate + cached;
    const legal = visibleLegalCards(
      remainingHands[activeActor],
      activeTrick,
      view.completedTrickCount + completedOffset === 0,
    );
    const outcomes = legal.map((card) =>
      search(
        {
          ...remainingHands,
          [activeActor]: remainingHands[activeActor].filter(
            ({ id }) => id !== card.id,
          ),
        },
        [...activeTrick, { seat: activeActor, card }],
        ((activeActor + 1) % 4) as Seat,
        completedOffset,
      ),
    );
    const future =
      activeActor === view.declarer
        ? Math.min(...outcomes)
        : Math.max(...outcomes);
    memo.set(key, future);
    return immediate + future;
  };

  return search(
    hands,
    [...view.currentTrick, { seat: view.viewer, card: candidate }],
    ((view.viewer + 1) % 4) as Seat,
    0,
  );
}

export function buildPerspectiveKnowledge(
  view: PlayerView,
  rememberedTricks = 13,
): PerspectiveKnowledge {
  const publicPlays = view.publicEvents.filter(
    (event): event is Extract<typeof event, { type: 'card-played' }> =>
      event.type === 'card-played',
  );
  const firstRememberedTrick = Math.max(
    0,
    view.completedTrickCount - rememberedTricks,
  );
  const played = publicPlays.slice(firstRememberedTrick * 4);
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
      if (play.card.kind === 'joker' || play.card.suit !== lead.suit) {
        voidSets[play.seat].add(lead.suit);
      }
    }
  }

  const known = new Set([
    ...view.ownHand.map(({ id }) => id),
    ...played.map(({ card }) => card.id),
    ...view.vipRevealedCards.map(({ id }) => id),
    ...view.openHands.flatMap(({ cards }) => cards.map(({ id }) => id)),
  ]);
  const unseenCardCountBySuit = Object.fromEntries(
    SUITS.map((suit) => [
      suit,
      RANKS.filter((rank) => !known.has(`${suit}:${rank}` as CardId)).length,
    ]),
  ) as Record<Suit, number>;
  const unseenRanksBySuit = Object.fromEntries(
    SUITS.map((suit) => [
      suit,
      RANKS.filter((rank) => !known.has(`${suit}:${rank}` as CardId)),
    ]),
  ) as unknown as Record<Suit, readonly Rank[]>;

  return {
    playedCardIds: played.map(({ card }) => card.id),
    unseenCardCountBySuit,
    unseenRanksBySuit,
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
  const special = view.winningBid?.kind === 'special';
  const specialDeclarer = special && view.declarer === view.viewer;
  const value = rankValue(card, special);
  const openHandDeclarerWins = openHandDeclarerWinsCurrentTrick(view, card);

  if (profile === 'beginner') {
    return {
      command,
      score: 30 - value,
      reasons: [reason('cheap-discard', 'spiller et lavt lovligt kort')],
    };
  }
  const openEndgameDeclarerTricks =
    profile === 'advanced' ? openHandEndgameDeclarerTricks(view, card) : null;

  const currentWinner = winningPlay(view.currentTrick, view.trump, special);
  const withCandidate = winningPlay(
    [...view.currentTrick, { seat: view.viewer, card }],
    view.trump,
    special,
  );
  const takesLead = withCandidate?.seat === view.viewer;
  const viewerHoldsCalledCard = view.ownHand.some(
    ({ id }) => id === view.calledPartnerCardId,
  );
  const teammates = knownTeammates(view);
  const onDeclarerTeam =
    view.viewer === view.declarer ||
    viewerHoldsCalledCard ||
    view.viewer === view.publicPartner;
  const partnerWinning =
    currentWinner !== null && teammates.includes(currentWinner.seat);

  if (specialDeclarer) {
    const openHandAdjustment =
      openHandDeclarerWins === null ? 0 : openHandDeclarerWins ? -300 : 300;
    const endgameAdjustment = -(openEndgameDeclarerTricks ?? 0) * 450;
    return takesLead
      ? {
          command,
          score: 20 - value + openHandAdjustment + endgameAdjustment,
          reasons: [
            reason(
              'avoid-special-trick',
              'begrænser skaden, når stikket ikke kan undgås',
            ),
            ...(openHandDeclarerWins !== null
              ? [
                  reason(
                    'open-hand-forcing',
                    openHandDeclarerWins
                      ? 'ser, at de åbne hænder kan tvinge dette stik til melderen'
                      : 'undgår med åbne kort at blive tvunget til at tage stikket',
                  ),
                ]
              : []),
            ...(openEndgameDeclarerTricks !== null
              ? [
                  reason(
                    'open-endgame-plan',
                    `planlægger restspillet til ${openEndgameDeclarerTricks} stik`,
                  ),
                ]
              : []),
          ],
        }
      : {
          command,
          score: 140 + value + openHandAdjustment + endgameAdjustment,
          reasons: [
            reason(
              'avoid-special-trick',
              'afgiver et farligt kort uden at tage stikket',
            ),
            ...(openHandDeclarerWins !== null
              ? [
                  reason(
                    'open-hand-forcing',
                    openHandDeclarerWins
                      ? 'ser, at de åbne hænder kan tvinge dette stik til melderen'
                      : 'undgår med åbne kort at blive tvunget til at tage stikket',
                  ),
                ]
              : []),
            ...(openEndgameDeclarerTricks !== null
              ? [
                  reason(
                    'open-endgame-plan',
                    `planlægger restspillet til ${openEndgameDeclarerTricks} stik`,
                  ),
                ]
              : []),
          ],
        };
  }

  if (special && view.declarer !== view.viewer) {
    const declarerHasPlayed = view.currentTrick.some(
      ({ seat }) => seat === view.declarer,
    );
    return {
      command,
      score:
        (takesLead ? 75 - value : 25 - value) +
        (declarerHasPlayed && !takesLead ? 35 : 0) +
        (openHandDeclarerWins === null
          ? 0
          : openHandDeclarerWins
            ? 300
            : -100) +
        (openEndgameDeclarerTricks ?? 0) * 450,
      reasons: [
        reason(
          'pressure-special-declarer',
          declarerHasPlayed
            ? 'lader helst melderen beholde et farligt stik'
            : 'søger kontrol til at presse melderen senere',
        ),
        ...(openHandDeclarerWins !== null
          ? [
              reason(
                'open-hand-forcing',
                openHandDeclarerWins
                  ? 'samarbejder ud fra de åbne hænder om at give melderen stikket'
                  : 'ser, at melderen kan undgå stikket med optimalt åbent spil',
              ),
            ]
          : []),
        ...(openEndgameDeclarerTricks !== null
          ? [
              reason(
                'open-endgame-plan',
                `koordinerer restspillet mod ${openEndgameDeclarerTricks} stik til melderen`,
              ),
            ]
          : []),
      ],
    };
  }

  if (view.currentTrick.length === 0) {
    const suitLength =
      card.kind === 'suited'
        ? view.ownHand.filter(
            (held) => held.kind === 'suited' && held.suit === card.suit,
          ).length
        : 0;
    const trumpCost =
      card.kind === 'suited' && card.suit === view.trump ? 8 : 0;
    const ownTrumps = view.ownHand.filter(
      (held) => held.kind === 'suited' && held.suit === view.trump,
    );
    const trumpControl =
      ownTrumps.length >= 4 || ownTrumps.some((held) => rankValue(held) >= 11);
    const shouldDrawTrump =
      !special &&
      onDeclarerTeam &&
      view.trump !== null &&
      knowledge.unseenCardCountBySuit[view.trump] > 0 &&
      ownTrumps.length >= 2 &&
      trumpControl;
    const trumpControlBonus =
      shouldDrawTrump && card.kind === 'suited' && card.suit === view.trump
        ? 34
        : 0;
    const higherRankStillHeld =
      card.kind === 'suited' &&
      view.ownHand.some(
        (held) =>
          held.kind === 'suited' &&
          held.suit === card.suit &&
          rankValue(held) > rankValue(card),
      );
    const higherRankStillUnseen =
      card.kind === 'suited' &&
      knowledge.unseenRanksBySuit[card.suit].some(
        (rank) => RANKS.indexOf(rank) > RANKS.indexOf(card.rank),
      );
    const topRemainingBonus =
      !special &&
      card.kind === 'suited' &&
      !higherRankStillHeld &&
      !higherRankStillUnseen &&
      (card.suit === view.trump ||
        view.trump === null ||
        knowledge.unseenCardCountBySuit[view.trump] === 0)
        ? 32
        : 0;
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
      score:
        suitLength * 10 -
        value -
        trumpCost +
        trumpControlBonus +
        topRemainingBonus +
        visibleVoidPressure,
      reasons: [
        ...(trumpControlBonus
          ? [
              reason(
                'draw-trump',
                'trækker modspillernes trumfer, mens melderholdet har kontrol',
              ),
            ]
          : []),
        ...(topRemainingBonus
          ? [
              reason(
                'cash-winner',
                'indkasserer det højeste resterende kort i farven',
              ),
            ]
          : []),
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
        score:
          (partnerWinning
            ? 20
            : view.currentTrick.length === 1
              ? 28
              : view.currentTrick.length === 2
                ? 112
                : 96) - value,
        reasons: [
          reason(
            partnerWinning
              ? 'support-partner'
              : view.currentTrick.length === 2
                ? 'third-hand-high'
                : 'cheapest-winner',
            partnerWinning
              ? 'undgår at stikke en kendt makkers vinder'
              : view.currentTrick.length === 2
                ? 'spiller tredje hånd højt nok til at sikre stikket'
                : 'tager føringen med det billigste tilstrækkelige kort',
          ),
        ],
      }
    : {
        command,
        score: 40 - value,
        reasons: [
          reason(
            view.currentTrick.length === 1
              ? 'second-hand-low'
              : 'cheap-discard',
            view.currentTrick.length === 1
              ? 'spiller som udgangspunkt lavt i anden hånd'
              : 'afgiver det billigste kort, når stikket ikke kan overtages',
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

function suitLengths(hand: readonly Card[]): Readonly<Record<Suit, number>> {
  return Object.fromEntries(
    SUITS.map((suit) => [
      suit,
      hand.filter((card) => card.kind === 'suited' && card.suit === suit)
        .length,
    ]),
  ) as Record<Suit, number>;
}

function normalHandEstimate(hand: readonly Card[], preferredTrump?: Suit) {
  const lengths = suitLengths(hand);
  const honors = hand.reduce((total, card) => {
    if (card.kind === 'joker') return total + 0.7;
    if (card.rank === 'ace') return total + 1;
    if (card.rank === 'king')
      return total + (lengths[card.suit] >= 2 ? 0.7 : 0.4);
    if (card.rank === 'queen')
      return total + (lengths[card.suit] >= 3 ? 0.4 : 0.2);
    if (card.rank === 'jack')
      return total + (lengths[card.suit] >= 4 ? 0.2 : 0.05);
    return total;
  }, 0);
  const trump =
    preferredTrump ??
    first(
      [...SUITS].sort((a, b) => suitStrength(hand, b) - suitStrength(hand, a)),
    );
  const trumpLength = lengths[trump];
  return honors + Math.max(0, trumpLength - 3) * 0.45;
}

function specialSafety(hand: readonly Card[]): number {
  const lengths = suitLengths(hand);
  const dangerous = hand.reduce((total, card) => {
    if (card.kind === 'joker') return total + 0.15;
    if (card.rank === 'king') return total + 1.4;
    if (card.rank === 'queen') return total + 0.9;
    if (card.rank === 'jack') return total + 0.55;
    if (card.rank === 'ten') return total + 0.3;
    return total;
  }, 0);
  const shortSuitEscape =
    SUITS.filter((suit) => lengths[suit] <= 2).length * 0.7;
  const lowCards = hand.filter(
    (card) =>
      card.kind === 'suited' &&
      (card.rank === 'ace' || card.rank === 'two' || card.rank === 'three'),
  ).length;
  return lowCards * 0.35 + shortSuitEscape - dangerous;
}

function expectedNumericalPoints(
  bid: NumericalBid,
  declarer: Seat,
  expectedTricks: number,
  uncertainty: number,
): number {
  const partner = ((declarer + 1) % 4) as Seat;
  const opponent = ((declarer + 2) % 4) as Seat;
  let totalWeight = 0;
  let weightedPoints = 0;
  for (let tricks = 0; tricks <= 13; tricks += 1) {
    const distance = (tricks - expectedTricks) / uncertainty;
    const weight = Math.exp(-0.5 * distance * distance);
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    counts[declarer] = tricks;
    counts[opponent] = 13 - tricks;
    const points = scoreNumericalContract(bid, declarer, partner, counts, 1)
      .deltas[declarer];
    totalWeight += weight;
    weightedPoints += weight * points;
  }
  return weightedPoints / totalWeight;
}

function bidEstimate(view: PlayerView, bid: Bid, profile: StrategyProfile) {
  const calibration =
    profile === 'beginner' ? -0.4 : profile === 'advanced' ? 0.1 : 0;
  if (bid.kind === 'special') {
    const safety = specialSafety(view.ownHand) + calibration;
    const breakEvenSafety = {
      sol: 2.8,
      'pure-sol': 4.2,
      'open-laydown': 5.5,
      'super-laydown': 7,
    }[bid.bidType];
    const successChance = 1 / (1 + Math.exp(-(safety - breakEvenSafety) / 0.9));
    const successfulCounts: [number, number, number, number] = [0, 0, 0, 0];
    const failedCounts: [number, number, number, number] = [0, 0, 0, 0];
    failedCounts[view.viewer] = bid.bidType === 'sol' ? 2 : 1;
    const success = scoreSpecialContract(bid, view.viewer, successfulCounts)
      .deltas[view.viewer];
    const failure = scoreSpecialContract(bid, view.viewer, failedCounts).deltas[
      view.viewer
    ];
    return (successChance * success + (1 - successChance) * failure) * 25;
  }

  const preferredTrump = bid.bidType === 'good' ? 'clubs' : undefined;
  const ownStrength = normalHandEstimate(view.ownHand, preferredTrump);
  // Before partnerships are known, the four seats are symmetric and a team
  // starts around half of the 13 tricks. Move that baseline up or down by how
  // far this hand lies from an average 13-card hand instead of pretending the
  // unknown partner contributes a small fixed number of tricks.
  const averageHandStrength = 2;
  const partnershipBaseline = 6.5;
  const contractAdjustment =
    bid.bidType === 'ordinary'
      ? 0
      : bid.bidType === 'halves'
        ? -0.5
        : bid.bidType === 'good'
          ? -0.4
          : -0.9;
  const expectedTeamTricks =
    partnershipBaseline +
    (ownStrength - averageHandStrength) * 0.55 +
    contractAdjustment +
    calibration;
  // A bid is worth its score across all plausible trick totals, not just the
  // chance of reaching its target. This captures both overtricks and the
  // increasing stake for a failed high contract.
  return (
    expectedNumericalPoints(bid, view.viewer, expectedTeamTricks, 1.6) * 25
  );
}

// A stable draw from the bidder's own cards and public auction. It gives each
// difficulty a distinct willingness to continue without introducing hidden
// information or non-reproducible bot turns.
function auctionDraw(view: PlayerView): number {
  const key = [
    view.viewer,
    view.revision,
    ...view.ownHand.map(({ id }) => id).sort(),
    ...view.publicEvents.flatMap((event) =>
      event.type === 'bid-placed' ? [JSON.stringify(event.bid)] : [],
    ),
  ].join('|');
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function continuationChance(
  view: PlayerView,
  profile: StrategyProfile,
): number {
  const base =
    profile === 'beginner' ? 0.55 : profile === 'advanced' ? 0.8 : 0.7;
  const priorRaises = Math.max(
    0,
    view.publicEvents.filter((event) => event.type === 'bid-placed').length - 1,
  );
  const levelPressure =
    view.currentBid?.kind === 'numerical'
      ? Math.max(0, view.currentBid.level - 7)
      : 4;
  return base * Math.pow(0.7, priorRaises) * Math.pow(0.78, levelPressure);
}

function exchangeValue(view: PlayerView, cardId: CardId): number {
  const card = view.ownHand.find(({ id }) => id === cardId);
  if (!card) return 0;
  const special = view.winningBid?.kind === 'special';
  return rankValue(card, special);
}

function scoreNonPlay(
  view: PlayerView,
  command: GameCommand,
  profile: StrategyProfile,
): StrategyDecision {
  if (command.type === 'pass') {
    return {
      command,
      score: 0,
      reasons: [
        reason(
          'conservative-pass',
          'undgår et overbud uden positivt forventet afkast',
        ),
      ],
    };
  }
  if (command.type === 'place-bid') {
    const estimate = bidEstimate(view, command.bid, profile);
    // Very compelling hands may bid regardless of the profile's usual
    // restraint. Marginal overcalls need both positive value and a favorable
    // deterministic draw, especially after several raises.
    const shouldContinue =
      view.currentBid === null ||
      estimate >= 150 ||
      (estimate > 0 && auctionDraw(view) < continuationChance(view, profile));
    const restrained = estimate > 0 && !shouldContinue;
    const score = shouldContinue ? estimate : Math.min(-1, estimate);
    return {
      command,
      score,
      reasons: [
        reason(
          restrained
            ? 'auction-restraint'
            : score > 0
              ? 'hand-supported-bid'
              : 'contract-risk',
          restrained
            ? 'stopper hellere budgivningen efter de hidtidige meldinger'
            : score > 0
              ? 'håndens sandsynlige stik og struktur støtter meldingen'
              : 'meldingen ligger over håndens forsigtige stikestimat',
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
  if (command.type === 'exchange-cards') {
    const discarded = command.discardedCardIds.reduce(
      (sum, id) => sum + exchangeValue(view, id),
      0,
    );
    const special = view.winningBid?.kind === 'special';
    return {
      command,
      score: special ? discarded : -discarded,
      reasons: [
        reason(
          'improves-exchange',
          special
            ? 'afleverer farlige høje kort i specialspillet'
            : 'forbedrer håndens forventede kortstyrke',
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
  const knowledge = buildPerspectiveKnowledge(view, REMEMBERED_TRICKS[profile]);
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
  const sampledHands =
    effectiveProfile === 'advanced' &&
    view.phase === 'trick-play' &&
    view.winningBid?.kind === 'numerical'
      ? samplePossibleHands(view, knowledge)
      : [];
  const candidates = sortCandidates(
    view.legalCommands.map((command) => {
      if (command.type !== 'play-card')
        return scoreNonPlay(view, command, effectiveProfile);
      const baseline = scorePlay(view, command, effectiveProfile, knowledge);
      if (sampledHands.length === 0) return baseline;
      const card = commandCard(view, command);
      const expectedTeamTricks =
        sampledHands.reduce(
          (sum, hands) => sum + sampledContinuationValue(view, card, hands),
          0,
        ) / sampledHands.length;
      return {
        ...baseline,
        score: baseline.score + expectedTeamTricks * 90,
        reasons: [
          ...baseline.reasons,
          reason(
            'sampled-continuation',
            `vurderer to stik på tværs af ${sampledHands.length} mulige kortfordelinger`,
          ),
        ],
      };
    }),
  );
  return { recommended: first(candidates), candidates, knowledge };
}

export function chooseStrategyAction(
  view: PlayerView,
  profile: StrategyProfile = 'practical',
): StrategyDecision | null {
  return analyzeStrategy(view, profile).recommended;
}
