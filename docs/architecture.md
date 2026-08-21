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

The initial IndexedDB schema is database version 1 with separate `active-game` and `completed-replays` stores. Both contain Zod-validated replay records (`schemaVersion: 1`); internal `GameState` is never persisted. Loading reconstructs state through `replayGame`, completed records are keyed idempotently by deal seed, and storage failure degrades to an in-memory session rather than blocking play.

### Development Rule Profile

Incremental behavior affected by `⚠️ AFKLARES` is isolated and explicitly provisional:

- The playable contract paths are `Almindelige` and `Gode`. `Gode` sets clubs as trump automatically and uses its confirmed doubled point value. Other bids remain valid in bidding but do not yet enter contract play.
- The initial path can continue without exchanging cards. Interactive exchange waits for rule 12 clarification.
- The replaceable development behavior forces the called partner card the first time its suit is led.
- The replaceable development behavior does not allow a joker instead of following a suit held in hand.
- The written provisional defaults for Vip exchange, self-partner scoring, and lost-special scoring may now be implemented behind named policy functions and focused tests.
- Special-contract trump remains unimplemented until a provisional trump rule is actually written, because section 25 currently supplies no default.

These choices are development adapters, not final confirmations. Each must be easy to replace with focused tests when its rule is resolved.

Presentation timing is separate from deterministic transitions. A new local deal reveals the human hand card by card before bidding controls unlock. Bot bidding uses a longer readable pause and exposes each public bid/pass; bot card play uses a shorter pause so a full round remains usable. Resumed games bypass the deal animation.

Card presentation uses international `A/K/Q/J` labels. Hands are grouped hearts, diamonds, spades, clubs, with each suit descending from ace to two and jokers last. This ordering is a UI concern and does not alter deck or rank semantics in `game-core`.

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

Profiles configure available features, memory policy, inference depth, lookahead budget, weights, and thresholds. Bots do not receive hidden state or deliberately choose random bad actions. Seeded tie-breaking is permitted only among near-equivalent candidates.

The implemented baseline exposes Beginner, Intermediate, and Advanced profiles through one `PlayerView`-only analysis API. It ranks every legal command, attaches structured reason codes, tracks publicly played cards, counts unseen suited cards, and records only renounces proven by public play. The current heuristics are intentionally modest; distribution inference, partnership tactics, and expert-approved thresholds remain future tuning work.

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

The implemented UI includes an on-demand progressive hint panel, exact recommendation disclosure with alternatives, highlighted recommended cards, and a completed-game replay dialog reconstructed step by step from the human seat. Every human action also caches the full pre-action report; optional post-move review compares against that immutable snapshot rather than later revealed cards. Guided mode and persistent assistance preferences remain.

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

## Later Multiplayer

Multiplayer adds a separate authoritative service rather than moving rules into UI or duplicating them:

- The server owns `GameState` and runs the same `applyCommand` validation.
- Clients send versioned commands and receive events plus their own projected view.
- Per-seat projections prevent hidden-card disclosure over the network.
- Private rooms map invite codes/links to server-owned games.
- Reconnect uses authenticated seat tokens, acknowledged revisions, and event/snapshot recovery.
- Persistence stores authoritative snapshots and append-only accepted events.
- WebSocket transport, authentication, rate limiting, room expiry, and hosting are chosen when multiplayer is scheduled.

The initial static client must not contain placeholder networking, room, database, or authentication infrastructure. Stable commands, events, state revisions, seeded determinism, and player projection are the only multiplayer-driven investments required now.
