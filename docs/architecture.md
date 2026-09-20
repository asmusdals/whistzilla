# Whistzilla Architecture

## Status And Goals

This document defines the target architecture. Confirmed rules are permanent behavior; `⚠️ AFKLARES` rules may use the product-owner-authorized provisional behavior written in `game-rules.md`.

The architecture optimizes for a deterministic and testable rules engine, information-safe strategy, explainable coaching, a polished shared web UI, low initial operating cost, and a later authoritative multiplayer server without rewriting core rules.

## Recommended Stack

| Concern            | Choice                            | Reason                                                             |
| ------------------ | --------------------------------- | ------------------------------------------------------------------ |
| Repository         | npm workspaces                    | Built-in tooling and manageable boundaries for one developer       |
| Language           | Strict TypeScript                 | Shared types and exhaustive domain modeling                        |
| Web                | React + Vite SPA                  | Interactive client application with no initial SSR or backend need |
| Navigation         | React Router                      | Explicit game, replay, and settings routes                         |
| UI state           | Zustand                           | Small adapter store around the engine and async orchestration      |
| Styling            | CSS Modules and design tokens     | Scoped, deliberate responsive design without coupling domain code  |
| UI primitives      | Radix primitives and Lucide icons | Accessible overlays/controls and consistent icons                  |
| Animation          | Motion plus CSS transitions       | Controlled card movement and interaction feedback                  |
| Localization       | i18next / react-i18next           | Danish-first copy with stable message keys                         |
| Persistence        | IndexedDB through a small adapter | Local resume and replay capacity without a database                |
| Runtime validation | Zod at serialized boundaries      | Versioned storage and future protocol validation                   |
| Unit tests         | Vitest and Testing Library        | Vite-aligned domain and component testing                          |
| Property tests     | fast-check                        | State, deck, legality, and information invariants                  |
| Browser tests      | Playwright                        | Desktop, phone, touch, persistence, and PWA workflows              |
| CI                 | GitHub Actions                    | Type checks, lint, unit tests, build, and browser smoke tests      |
| Hosting            | Netlify                           | Static Vite deployment, previews, CDN, and no framework lock-in    |

Next.js is not recommended initially: Whistzilla does not need server rendering, route loaders, server actions, or an application server. Capacitor should be added only after the PWA stabilizes; the web-first architecture and responsive UI remain the source of truth.

## Workspace Boundaries

```text
apps/
  web/                 React UI, browser adapters, routes, assets
packages/
  game-core/           Rules, state, commands, events, projections
  strategy/            Bots, beliefs, bidding and play evaluators
  coaching/            Explanation plans, comparison and localization data
docs/                  Product, rules, architecture and roadmap
```

Dependencies point inward:

```text
web -> coaching -> strategy -> game-core
web -----------------------> game-core
```

`game-core` must not depend on any other workspace package or on React, DOM APIs, IndexedDB, localization, timers, or network APIs.

## Core Domain Model

Names below describe interface responsibilities. Fields affected by `⚠️ AFKLARES` may be implemented, but their policy must remain explicit and replaceable until clarification.

```ts
type Seat = 0 | 1 | 2 | 3;

type Card =
  | { kind: 'suited'; id: CardId; suit: Suit; rank: Rank }
  | { kind: 'joker'; id: CardId; joker: JokerId };

type GamePhase =
  | 'setup'
  | 'bidding'
  | 'contractSetup'
  | 'exchange'
  | 'trickPlay'
  | 'scoring'
  | 'complete';

interface TransitionSuccess {
  state: GameState;
  events: readonly GameEvent[];
}

function applyCommand(
  state: GameState,
  command: GameCommand,
): Result<TransitionSuccess, RuleViolation>;

function legalActions(state: GameState, seat: Seat): readonly GameCommand[];
function projectPlayerView(state: GameState, seat: Seat): PlayerView;
```

- `GameState` is the complete authoritative state and may contain all hands.
- `GameCommand` expresses player intent and includes the acting seat and expected state revision.
- `GameEvent` records accepted facts suitable for replay and later network transport.
- `RuleViolation` is structured and stable enough for tests and localized UI messages.
- State transitions are immutable and deterministic. Shuffle randomness is injected and seeded.
- The digital deal policy distributes the shuffled deck clockwise, beginning left of the dealer, until each seat has 13 cards; the final 3 cards form `bytterne`. This is one valid distribution method under rule 2.3, not an additional game rule.
- A persisted replay contains schema version, rules version, seed metadata, and accepted commands/events. It must reconstruct the same state exactly.
- The engine is a state machine; the UI does not set phases, move cards, choose winners, or calculate scores directly.

## Player-Perspective Information Model

Strategy and coaching never receive `GameState`. The web layer asks `game-core` to create a `PlayerView` for the acting seat and passes only that projection onward.

```ts
interface PlayerView {
  seat: Seat;
  phase: GamePhase;
  ownHand: readonly Card[];
  publicState: PublicGameState;
  currentTrick: readonly PublicPlay[];
  publicHistory: readonly PublicEvent[];
  legalActions: readonly PlayerAction[];
  knowledge: readonly KnowledgeFact[];
}

type KnowledgeSource =
  | 'currentlyVisible'
  | 'recallableHistory'
  | 'certainDeduction'
  | 'probabilisticInference';

interface KnowledgeFact {
  subject: KnowledgeSubject;
  claim: KnowledgeClaim;
  source: KnowledgeSource;
  confidence: number;
  evidence: readonly PublicEvidenceRef[];
}
```

- Currently visible facts include the player's hand, table cards, contract, public roles, scores, and current turn.
- Recallable history contains only facts previously exposed publicly, such as earlier tricks.
- Certain deductions follow logically from public behavior and rules, such as a player being void in a suit after failing to follow when required.
- Probabilistic inference represents beliefs about unknown distributions and must carry evidence and calibrated uncertainty.
- Hidden hands and undealt hidden cards do not appear in any field, evidence object, debug metadata, or explanation input.
- A separate `RecallPresentationPolicy` determines what history the UI resurfaces. It does not alter the authoritative public history or turn uncertain information into fact.

The strongest non-cheating test is view invariance: two full states with different hidden cards but the same `PlayerView` must produce the same deterministic evaluation and explanation for a fixed strategy profile and seed.

## Commands, Events, Persistence, And UI

1. The UI derives available controls from `legalActions` or submits a typed command.
2. `game-core` validates the command and returns new state plus domain events.
3. The application store commits the transition and schedules bot turns, animation, persistence, and sounds as effects.
4. Before a human decision, the strategy layer may evaluate the immutable `PlayerView`.
5. The pre-action recommendation report is cached with the state revision for later comparison.
6. IndexedDB stores a versioned active-game record and completed replay logs through an adapter owned by `apps/web`; small non-sensitive preferences such as bot difficulty use `localStorage`.

Persist only validated serialized forms. Migrations operate between explicit schema versions and retain the original replay log where possible.

IndexedDB database version 2 contains separate `active-game`, `completed-replays`,
and `match-progress` stores. The first two contain Zod-validated replay records
(`schemaVersion: 1`); internal `GameState` is never persisted. `match-progress`
stores only cumulative point totals, completed-round count, the next dealer, and
the last scored seed so a completed replay cannot be counted twice after refresh.
Loading reconstructs game state through `replayGame`, completed records are keyed
idempotently by deal seed, corrupt history entries are ignored individually, and
storage failure degrades to an explicitly announced in-memory session rather
than blocking play.

Replay schema version 1 includes the atomic `exchange-cards` command with only
the selected hand-card identities. The core deterministically takes the same
number of face-down kitty cards, so their identities never enter the player's
command or pre-exchange projection. Legacy version-1 records containing a
`kittyCardIds` property remain readable; validation strips that obsolete choice.
The public exchange event contains only the count.

### Development Rule Profile

Incremental behavior affected by `⚠️ AFKLARES` is isolated and explicitly provisional:

- All numerical and special contract paths are playable. Halve transfers trump
  and exchange decisions to the called partner, while Vip reveals kitty cards
  sequentially and uses its reveal-count scoring row. Sol, Ren sol, Bordlægger,
  and Super bordlægger use the confirmed no-trump, ace-low special rules.
- A named provisional rule-12 policy allows the exchange actor in `Almindelige`,
  `Halve`, and `Gode` to skip or exchange 1-3 cards. The actor selects hand
  discards without seeing the kitty and receives the same number of face-down
  kitty cards, revealed only after the atomic transition. Discards are tracked
  separately and never become new kitty cards.
- The replaceable development behavior forces the called partner card the first time its suit is led.
- The replaceable development behavior does not allow a joker instead of following a suit held in hand.
- Vip currently follows the written provisional joker policy: an opening joker
  gives the declarer a free suit choice, a joker after a suited card preserves
  the prior trump, and three jokers resolve to no trump. Every revealed Vip card
  must be exchanged.
- Self-partner scoring uses the written provisional three-against-one
  distribution: the declarer receives or pays three stakes and every opponent
  one stake.
- Lost-special scoring uses the confirmed opposite-sign policy behind
  `scoreSpecialContract`; its win thresholds and fixed values remain explicit.

These choices are development adapters, not final confirmations. Each must be easy to replace with focused tests when its rule is resolved.

Presentation timing is separate from deterministic transitions. A new local deal reveals the human hand card by card before bidding controls unlock. Bot bidding uses a longer readable pause and exposes each public bid/pass; bot card play uses a shorter pause so a full round remains usable. After the fourth card completes a trick, the UI renders the completed trick and uses a longer pause before a bot leads again, ensuring the fourth card is visible even though the deterministic core has already moved it into completed history. Resumed games bypass the deal animation.

Reduced-motion preference bypasses the deal reveal and collapses CSS animation.
Optional synthesized action tones are presentation-only, default off, and persist
as a local preference; they never influence deterministic transition timing.

React Router owns the top-level `/`, `/training`, and `/points` routes. The home
screen is a presentation/navigation boundary; Training owns the persisted local
game session, and the points calculator calls `game-core` scoring directly.
Multiplayer is now the next major milestone; the current Training route remains
local until an authoritative service exists. See `docs/multiplayer.md` for the
first playable room boundary.

After scoring, Training presents all four per-round deltas and starts the next
round with the dealer rotated one seat clockwise. Starting over before a round
has completed retains the current dealer; only a completed round advances it.

Card presentation uses international `A/K/Q/J` labels. Hands are grouped hearts, diamonds, spades, clubs, with each suit descending from ace to two and jokers last. This ordering is a UI concern and does not alter deck or rank semantics in `game-core`.

The bidding UI derives all options from perspective-safe legal commands and
separates contract type from numerical level. Special bids do not display a
numerical level. A legally won contract whose setup policy is still unresolved
is retained in deterministic state and presented as awaiting rule clarification;
the UI does not invent setup behavior to advance it.

## Practical Strategy Model

Both bid and play analysis rank only actions supplied as legal by the core.

```ts
interface CandidateEvaluation<Action> {
  action: Action;
  score: number;
  quality: 'preferred' | 'strong' | 'reasonable' | 'dubious' | 'mistake';
  factors: readonly StrategicFactor[];
  uncertainty: EvaluationUncertainty;
}

interface RecommendationReport<Action> {
  stateRevision: number;
  profileId: StrategyProfileId;
  candidates: readonly CandidateEvaluation<Action>[];
  knowledgeUsed: readonly KnowledgeFactRef[];
}
```

Strategic factors are structured reason codes with values, evidence, and human-facing importance. Initial features should cover hand strength, suit length, likely winners, trump control, outstanding cards, trick position, partner status, entries, voids, suit establishment, risk, and contract objective. New evaluators or later simulation can implement the same interfaces.

### Bot Difficulty

- Beginner uses simple contract features, local trick tactics, coarser risk bands, limited card tracking, and shallow inference.
- Intermediate tracks public play reliably, applies conventional Whist heuristics, reasons about partner/opponents, and combines multiple tactical factors.
- Advanced uses complete legitimate public memory, stronger distribution inference, card counting, deeper tactical sequencing, and better risk calibration.

Profiles configure available features, memory policy, inference depth, lookahead budget, weights, and thresholds. Bots do not receive hidden state. Beginner may make weaker, plausible choices; the product owner authorized occasional mistakes on 2026-09-19. Their rate and quality must be measured against the same visible information rather than produced by access to hidden state. Seeded tie-breaking is permitted among near-equivalent candidates.

The implemented baseline exposes Beginner, Intermediate, and Advanced profiles through one `PlayerView`-only analysis API. It ranks every legal command, attaches structured reason codes, tracks publicly played cards, tracks the exact publicly unresolved ranks by suit, and records only renounces proven by public play (including legal joker discards). `buildPerspectiveKnowledge(view, rememberedTricks)` defaults to full public history, while the strategy profile currently recalls zero, four, or all completed tricks; the current trick remains visible at every level. Numerical bidding estimates a distribution of possible team trick totals from hand strength and computes expected points through `game-core` scoring, including overtricks and failure stakes. The provisional distribution accounts for the less certain trump/partner choices in Halve, Gode, and Vip. Special bids turn a provisional hand-safety estimate into a success probability and compare actual success/failure point values through `game-core` scoring. Passing is the neutral baseline; an overbid needs positive expected return. A view-derived deterministic draw gives Beginner, Intermediate, and Advanced different continuation probabilities, decreasing after raises and higher bids; exceptionally favorable estimates can proceed regardless. These are inspectable approximations, not a calibrated claim of optimal bidding. Normal play includes second-hand-low, third-hand-high, economical winning, known-teammate protection on both declarer and defender sides, trump drawing only with some hand control, and cashing a highest remaining trump; special play reverses the declarer's trick objective. Advanced numerical play samples up to 24 plausible unseen deals from its `PlayerView`, removing known cards and respecting publicly proven void suits. It compares each legal card across the same samples using a deterministic two-trick continuation; the simulated players choose from their own sampled hands and public trick information. This is bounded approximate planning, not perfect play or access to actual hidden hands. The current bid and bidder are derived from authoritative bidding state and displayed persistently in the table UI. The table also exposes the current turn, the winner of the last trick, and the human player's legal-play constraint. A rotated 128-seed evaluation compares difficulty levels and a fixed ordinary contract without using human replays; see `docs/bot-evaluation.md`. In Bordlægger and Super bordlægger, only the declarer's hand is exposed in `PlayerView`; Super bordlægger exposes it before the first play. Perfect-information all-hands search is consequently unavailable in live play. Broader strength evaluation and distribution calibration remain future tuning work.

### Bidding Analysis

The bid evaluator will:

1. Receive the bidding `PlayerView`, legal bids, and a strategy profile.
2. Extract rule-defined features such as suit structure, control, likely tricks, joker implications, partner implications, and risk.
3. Evaluate each legal bid and pass against its contract objective and threshold.
4. Return a ranked report with the preferred bid, reasonable alternatives, risks, and evidence.

Exact features and thresholds must wait for the authoritative bid and contract rules.

### Card-Play Analysis

The play evaluator will score every legal card using trick position, lead/follow status, current winning card, partner likelihood, trump state, outstanding cards, likely future winners, entries, preservation value, forcing value, contract objective, and belief uncertainty. Evaluation remains heuristic initially; probability or simulation modules may later contribute factors through the same report format.

## Explanation Architecture

The coaching package consumes `RecommendationReport`, referenced `KnowledgeFact` values, the chosen action, and assistance settings. It does not receive full game state.

An explanation plan contains localized reason keys and structured parameters, not prewritten strategy prose. For example, a factor can express that an action preserves a likely winner, cite the public tricks supporting that belief, and label it as inference. Danish templates render the plan for the UI.

Rules for explanations:

- Never assert an unknown card location as fact.
- State whether evidence is visible now, recalled from history, deduced, or inferred.
- Suppress internal scores unless the selected assistance mode calls for relative strength.
- Prefer two or three decisive reasons over listing every factor.
- Generate post-move feedback from the cached pre-action report, before later cards reveal hidden information.
- Keep raw debug traces out of production explanation objects.

## Responsive Coaching UI

- Desktop uses a collapsible side panel alongside an unframed table.
- Phone uses a bottom sheet that preserves the hand and current trick above it.
- Hint mode reveals considerations progressively and does not highlight an exact card initially.
- Guided mode uses a quiet, dismissible indication that the position merits review.
- Training mode may highlight candidates and expose ranked comparisons.
- Replay mode provides a decision timeline and reconstructs the exact perspective available at each action.
- All layouts support reduced motion, safe areas, touch targets, keyboard focus, and non-color status cues.

The implemented UI includes an on-demand progressive hint panel, exact recommendation disclosure with alternatives, highlighted recommended cards, and a completed-game replay dialog reconstructed step by step from the human seat. Every human action also caches the full pre-action report; optional post-move review compares against that immutable snapshot rather than later revealed cards.

Assistance preference is now stored as a small local setting with four modes:
none, on-demand hint, guided decision marker, and persistent training. This
preference changes presentation only; every report still receives the same
perspective-safe `PlayerView` boundary.

## PWA Foundation

The production client includes a web app manifest, 192/512/apple raster icons, standalone display metadata, and a small service worker. The service worker caches the application shell and same-origin assets after first use, serves cached navigation when offline, and is registered only in production builds. Before release, add explicit offline/update browser tests and an update-notification flow; do not treat the initial cache as final release hardening.

## Testing Architecture

- Unit tests cover card identity, deck construction, commands, phase transitions, legality, trick resolution, scoring, projections, evaluators, and explanation selection.
- Property tests cover card conservation, unique ownership, legal-action completeness, deterministic replay, impossible-state rejection, and projection invariants.
- Rule tables cover bidding hierarchy, trump, exchange, partner and self-partner cases, jokers, special contracts, and scoring once specified.
- Strategy contract tests assert legal output and deterministic behavior for a fixed view/profile/seed.
- Information-safety tests vary hidden state while holding the projected view constant and assert identical reports.
- Component tests cover controls, coach disclosure, localization, and accessibility behavior.
- Playwright covers a complete local game, refresh/resume, replay, desktop and portrait-phone layouts, touch interaction, and later PWA installation/offline smoke tests.

## Deployment

Use Netlify for the static Vite build, production deployment from `main`, and pull-request previews. Do not add Netlify Functions merely because they are available. Review hosting limits before public launch and record any later platform change here.

## Multiplayer Milestone

Multiplayer adds a separate authoritative service rather than moving rules into UI or duplicating them:

- The server owns `GameState` and runs the same `applyCommand` validation.
- Clients send versioned commands and receive events plus their own projected view.
- Per-seat projections prevent hidden-card disclosure over the network.
- Private rooms map invite codes/links to server-owned games.
- Reconnect uses authenticated seat tokens, acknowledged revisions, and event/snapshot recovery.
- Persistence stores authoritative snapshots and append-only accepted events.
- Transport, seat authentication, rate limiting, room expiry, and hosting are chosen in the first server slice.

`@whistzilla/multiplayer` is the initial server-side boundary. Its in-memory `RoomService` owns `GameState`, issues cryptographically random room IDs and private seat tokens, waits for four occupied seats, validates commands with `applyCommand`, and returns only `PlayerView` plus public events. It has no transport or durable store yet. The current static client does not contain room, database, or authentication infrastructure. The first playable room boundary and delivery order are specified in `docs/multiplayer.md`.
