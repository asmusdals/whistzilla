# Whistzilla Implementation Roadmap

## Delivery Rules

- Complete one small milestone at a time and keep the repository runnable.
- Confirmed rules are preferred, but a `⚠️ AFKLARES` section may proceed using its written provisional/default behavior. Keep that behavior isolated and marked for later review.
- Every milestone ends with relevant automated tests, documentation updates, and a passing CI path.
- Architecture supports later capabilities through stable boundaries, not unused infrastructure.

## Milestone 0: Rules Approval

**Status:** Active baseline. The rules are authoritative, and 10 explicitly marked questions remain open. Product-owner authorization on 2026-08-21 allows their written provisional defaults to be implemented before final confirmation.

Establish `game-rules.md` as the approved source, mark every unresolved point with `⚠️ AFKLARES`, and maintain the open-question register. Flagged behavior may proceed from an explicitly written provisional rule and must remain replaceable; a flag with no default still needs product input.

**Exit:** the product owner approves the confirmed rules, all known ambiguities are explicitly marked, and each later milestone checks its own rule dependencies before implementation.

## Milestone 1: Project Foundation And Testing

**Status:** Complete locally. CI configuration is present and will be verified by the next GitHub run.

Create npm workspaces, the Vite React application, framework-free package shells, strict TypeScript, lint/format commands, Vitest, Playwright, and GitHub Actions. Enforce package dependency direction and establish Danish localization plumbing without building gameplay.

**Exit:** clean install, type check, unit smoke test, production build, and browser smoke test pass locally and in CI.

## Milestone 2: Card, Deck, Shuffle, And Deal

**Status:** Complete.

Implement immutable card identities, 52 suited cards, 3 individually identified jokers, seeded shuffle injection, clockwise round-robin dealing beginning left of the dealer, 13 cards per seat, a 3-card `bytterne`, and reproducibility metadata. The selected distribution is an application dealing method permitted by rule 2.3.

**Exit:** example and property tests prove uniqueness, conservation, deterministic shuffle, exact dealing, and invalid-deck rejection.

## Milestone 3: State Machine, Replay, And Player View

**Status:** Complete for initial deal and bidding. Perspective projection, revisioned commands, public events, deterministic replay, and hidden-card invariance tests are implemented; later phases extend the same model.

Create commands, events, revisions, immutable state transitions, legal-action queries, replay reconstruction, public event history, `PlayerView`, knowledge provenance, and projection tests.

**Exit:** deterministic headless transitions and replay work; hidden-state variation cannot alter an equivalent projected view.

## Milestone 4: Bidding Engine

**Status:** Complete for the confirmed bidding rules, including numerical hierarchy, special-bid thresholds, opening-pass prevention, "melde tilbage," and one winning bidder.

Implement bidding phases, turn order, bid hierarchy, legal bids, passes, termination, and declarer/contract selection exactly as specified.

**Exit:** table-driven tests cover every bid transition, hierarchy boundary, invalid action, and termination path.

## Milestone 5: Contract Setup

**Status:** In progress. `Almindelige` supports declarer-selected trump. `Gode` automatically sets clubs as trump and follows the same legal ace/king partner path. Both support hidden partner identity, partner reveal, and an explicit no-exchange development path. Halve, Vip, exchange, and provisional self-partner behavior may now proceed from their written defaults. Special-contract trump still lacks a default.

Implement trump selection, exchange, partner/makkeres, self-partner behavior, role revelation, and contract-specific setup.

**Exit:** each contract reaches trick play with correct ownership, public information, and roles; edge cases are tested.

## Milestone 6: Trick-Playing Engine

**Status:** Complete for normal `Almindelige` play under the documented development profile: first lead, following suit, free discard when void, trump and rank winners, joker lead/discard behavior, partner reveal, next leader, and all 13 tricks are implemented.

Implement leads, legal following, trump behavior, jokers, trick winner determination, trick history, and next-leader transitions.

**Exit:** exhaustive examples and properties cover legal cards, winner resolution, card conservation, and all joker/special-contract branches.

## Milestone 7: Scoring And Full-Round Integration

**Status:** Complete for two-versus-two `Almindelige` and `Gode`. Confirmed trick values, doubled Gode values, overtricks, failed-contract penalties, per-player zero-sum deltas, and end-of-round integration are implemented. Provisional self-partner and lost-special scoring may now proceed from their written defaults; Vip scoring depends on implementing Vip setup.

Implement contract results, scoring, penalties, partner allocation, match completion, and a headless full-game runner.

**Exit:** every scoring table row is tested and seeded complete games replay to the same final result.

## Milestone 8: Basic Playable Game

**Status:** First end-to-end MVP paths complete for `Almindelige` and `Gode`. The responsive table includes readable deal/bidding timing, international card labels, suit/rank hand ordering, contract setup, the documented no-exchange path, all 13 tricks, scoring, refresh/resume, completed replay archiving, replay review, and a completed-game screen. Remaining contracts are gated by rule clarification.

Build the responsive table, bidding controls, card interactions, turn/status presentation, legality-only bot driver, IndexedDB resume, settings, and completed replay storage. Optimize portrait phones and desktop together.

**Exit:** one human can complete and resume a full game against three automated legal-action players on desktop and phone.

## Milestone 9: Practical Bot Strategy

**Status:** In progress. Deterministic profiles choose only commands from `PlayerView`, rank every legal candidate, emit structured reasons, remember public cards, count unseen suited cards, and infer only publicly proven renounces. Stronger partnership tactics, distribution inference, seeded evaluation fixtures, and expert tuning remain.

Add feature extraction, belief tracking from `PlayerView`, conventional bidding and play heuristics, candidate reports, and seeded tie-breaking. Replace the legality-only driver with a practical baseline bot.

**Exit:** bots always act legally, never access hidden state, explain their decisive factors, and pass deterministic scenario fixtures.

## Milestone 10: Bidding Recommendations

**Status:** Started. The shared analysis API ranks all legal bids, provides alternatives, and marks unsupported MVP contracts without letting bots select them. Expert-approved hand thresholds and bidding scenario fixtures remain.

Rank all legal bids and pass, expose alternatives and uncertainty, and add bidding scenario fixtures supplied or approved by a knowledgeable Whist player.

**Exit:** recommendations are perspective-safe, stable, and accompanied by structured reason codes and evidence.

## Milestone 11: Card-Play Recommendations

**Status:** Started. Every legal card receives a deterministic tactical score and structured reasons using current-trick information and public memory. Full pre-action candidate reports are cached for perspective-safe post-move comparison. Partnership tactics, richer preservation/forcing evaluation, and curated scenarios remain.

Evaluate every legal card using tactical factors, public history, known facts, and inferred distributions. Cache pre-action reports for post-move comparison.

**Exit:** curated trick scenarios produce defensible rankings; hidden-state invariance and legal-candidate coverage pass.

## Milestone 12: Coaching And Review UI

**Status:** In progress. On-demand hints progressively reveal strategic considerations, visible/remembered/inferred facts, the recommended action, alternatives, and highlighted candidate cards. Optional post-move feedback uses the cached pre-action report, and completed replays can be reviewed command by command from the human perspective. Guided mode and persistent assistance modes remain.

Implement no-assistance, hint, guided, and training modes; progressive hints; desktop panel; phone bottom sheet; candidate comparison; post-move feedback; and perspective-correct replay review.

**Exit:** each mode exposes only its intended information, remains usable on target viewports, and never derives feedback from later hidden reveals.

## Milestone 13: Difficulty Levels

**Status:** Started. Beginner, Intermediate, and Advanced profiles are selectable and persisted locally. Beginner uses simple deterministic low-card behavior; higher profiles add current-trick tactics and legitimate public-memory signals. Scenario-based tuning and measurable strength evaluation remain.

Create Beginner, Intermediate, and Advanced strategy profiles by varying feature coverage, memory, inference, lookahead, and risk calibration. Tune against scenario suites and bot-versus-bot evaluation without teaching deliberate random mistakes.

**Exit:** levels show measurable decision-quality differences, remain legal and non-cheating, and retain human-readable reasons.

## Milestone 14: Polish And PWA

**Status:** Started. The production build includes install metadata, generated raster app icons, a manifest, production-only service-worker registration, shell caching, and offline navigation fallback. Update UX, explicit install/offline tests, accessibility audit, reduced motion, animation, sound, and visual regression coverage remain.

Refine card readability, typography, spacing, feedback, sound controls, reduced motion, accessibility, table animation, loading states, error recovery, manifest, service worker, installability, and offline startup.

**Exit:** visual regression checks pass on representative desktop and mobile viewports; install, update, offline, and resume flows are verified.

## Milestone 15: Native Packaging Evaluation

Validate the stable PWA inside Capacitor, identify native-only requirements, and add platform projects only if store distribution provides clear value.

**Exit:** a documented go/no-go decision includes maintenance and store-release costs.

## Milestone 16: Human Multiplayer Later

Design and build a separate authoritative service for four humans, private rooms, invite links, reconnect, hidden-card projections, server validation, persistence, and abuse controls. Select transport and hosting from measured requirements at that time.

**Exit:** four remote clients can reconnect to a server-validated game without receiving another seat's hidden information.
