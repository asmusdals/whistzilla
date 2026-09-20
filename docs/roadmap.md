# Whistzilla Implementation Roadmap

## Delivery Rules

- Complete one small milestone at a time and keep the repository runnable.
- Confirmed rules are preferred, but a `⚠️ AFKLARES` section may proceed using its written provisional/default behavior. Keep that behavior isolated and marked for later review.
- Every milestone ends with relevant automated tests, documentation updates, and a passing CI path.
- Architecture supports later capabilities through stable boundaries, not unused infrastructure.

## Milestone 0: Rules Approval

**Status:** Active baseline. The rules are authoritative, and 8 explicitly marked questions remain open. Product-owner authorization on 2026-08-21 allows their written provisional defaults to be implemented before final confirmation.

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

**Status:** Complete for the confirmed bidding rules, including numerical hierarchy, special-bid thresholds, opening-pass prevention, strict clockwise turns with passed seats skipped, and one winning bidder.

Implement bidding phases, turn order, bid hierarchy, legal bids, passes, termination, and declarer/contract selection exactly as specified.

**Exit:** table-driven tests cover every bid transition, hierarchy boundary, invalid action, and termination path.

## Milestone 5: Contract Setup

**Status:** Complete for all contracts. Numerical contracts support their contract-specific trump, partner, reveal, exchange, and self-partner paths. Special contracts use the confirmed no-trump setup and their one-against-three roles. Vip's written provisional joker/exchange policies and the provisional self-partner policy remain isolated and tested.

Implement trump selection, exchange, partner/makkeres, self-partner behavior, role revelation, and contract-specific setup.

**Exit:** each contract reaches trick play with correct ownership, public information, and roles; edge cases are tested.

## Milestone 6: Trick-Playing Engine

**Status:** Complete for all numerical contract paths under the documented development profile: first lead, following suit, free discard when void, trump/no-trump and rank winners, joker lead/discard behavior, partner reveal, next leader, and all 13 tricks are implemented.

Implement leads, legal following, trump behavior, jokers, trick winner determination, trick history, and next-leader transitions.

**Exit:** exhaustive examples and properties cover legal cards, winner resolution, card conservation, and all joker/special-contract branches.

## Milestone 7: Scoring And Full-Round Integration

**Status:** Complete for numerical and special contracts, including Halve values, reveal-count Vip values, fixed special values, early special failure, overtricks, failed-contract penalties, two-versus-two deltas, and one-against-three distributions. Lost-special scoring uses the confirmed opposite-sign policy.

Implement contract results, scoring, penalties, partner allocation, match completion, and a headless full-game runner.

**Exit:** every scoring table row is tested and seeded complete games replay to the same final result.

## Milestone 8: Basic Playable Game

**Status:** Every numerical and special bid has an end-to-end local path. A responsive Whistzilla home screen links to Training and a game-core-backed points calculator while marking Multiplayer as future work. The table includes clockwise bidding, readable timing, a retained four-card completed trick, international card labels, suit/rank hand ordering, separate bid-type/level controls, contract-specific setup, hidden-kitty exchange, normal and ace-low trick play, Bordlægger hand exposure, a four-player round and cumulative result summary, persisted dealer rotation, refresh/resume, replay archiving/review, announced storage recovery, and a completed-game screen.

Build the responsive table, bidding controls, card interactions, turn/status presentation, legality-only bot driver, IndexedDB resume, settings, and completed replay storage. Optimize portrait phones and desktop together.

**Exit:** one human can complete and resume a full game against three automated legal-action players on desktop and phone.

## Milestone 9: Practical Bot Strategy

**Status:** In progress. Deterministic profiles choose only commands from `PlayerView`, rank every legal candidate, emit structured reasons, count unseen suited cards, and infer only publicly proven renounces. Numerical bids use a provisional trick-total distribution and actual point scoring to compare expected returns; special bids still use heuristics. Advanced numerical play samples plausible hidden deals and compares two-trick continuations without seeing actual hidden cards. Distribution calibration, broader seeded evaluation fixtures, and strength calibration remain.

Add feature extraction, belief tracking from `PlayerView`, conventional bidding and play heuristics, candidate reports, and seeded tie-breaking. Replace the legality-only driver with a practical baseline bot.

**Exit:** bots always act legally, never access hidden state, explain their decisive factors, and pass deterministic scenario fixtures.

## Milestone 10: Bidding Recommendations

**Status:** In progress. The shared analysis API ranks every legal bid and pass using visible hand honors, suit structure, a provisional numerical trick distribution, actual scoring outcomes, special-hand safety, and difficulty calibration. A 2026-09-20 seeded auction calibration now puts most Intermediate and Advanced outcomes at numerical level 9 or 10, with Sol occasional and 11+ uncommon. A deterministic continuation draw varies by difficulty and becomes less permissive only after several raises or above level 9. A follow-up full-game measurement by bid type found excessive failed Halve contracts and optimistic Advanced bidding; contract-specific risk adjustments improved numerical success in the original seed range while retaining the 9–10 auction mix. A separate seed range confirmed that the resulting success rates and auction levels remain comparable. High contracts still fail frequently, so the hand-strength estimate and play quality need further expert-backed calibration before expected-point optimality can be claimed. Results and limits are recorded in `docs/bot-evaluation.md`; existing human test replays are excluded from strategy training by product-owner request.

Rank all legal bids and pass, expose alternatives and uncertainty, and add bidding scenario fixtures supplied or approved by a knowledgeable Whist player.

**Exit:** recommendations are perspective-safe, stable, and accompanied by structured reason codes and evidence.

## Milestone 11: Card-Play Recommendations

**Status:** In progress. Every legal card receives a deterministic tactical score and structured reasons using current-trick information and public memory. Bots avoid overtaking a known teammate, including a fellow defender after the declarer partner is revealed, apply second-hand-low and third-hand-high, draw trump only with some hand control, cash publicly established top trumps, infer renounces from legal joker discards, use opposite trick objectives as special declarer/defender, and choose face-down exchanges by discard quality. Advanced numerical play compares up to 24 public-history-consistent sampled deals across two tricks. Under the revised Super bordlægger visibility rule, strategy sees only the declarer's open hand and cannot use the earlier all-hands search. Full pre-action reports are cached for perspective-safe comparison. Richer early-game preservation, forcing, and longer-horizon planning remain.

Evaluate every legal card using tactical factors, public history, known facts, and inferred distributions. Cache pre-action reports for post-move comparison.

**Exit:** curated trick scenarios produce defensible rankings; hidden-state invariance and legal-candidate coverage pass.

## Milestone 12: Coaching And Review UI

**Status:** In progress. Persisted no-assistance, hint, guided, and training modes control the coaching presentation. Hints progressively reveal strategic considerations, visible/remembered/inferred facts, the recommended action, alternatives, and highlighted candidate cards. The table now names the active turn, marks the winner of the last trick, and explains the human player's legal card choice, including suit following and a forced called card. Optional post-move feedback uses the cached pre-action report, and completed replays can be reviewed command by command from the human perspective. Richer guided prompts and replay decision filtering remain.

Implement no-assistance, hint, guided, and training modes; progressive hints; desktop panel; phone bottom sheet; candidate comparison; post-move feedback; and perspective-correct replay review.

**Exit:** each mode exposes only its intended information, remains usable on target viewports, and never derives feedback from later hidden reveals.

## Milestone 13: Difficulty Levels

**Status:** In progress. Beginner, Intermediate, and Advanced profiles are selectable and persisted locally. Beginner uses simple deterministic low-card behavior and no completed-trick recall, Intermediate recalls four completed tricks, and Advanced recalls all public play. The current trick remains visible for each profile. A reproducible 128-seed, four-seat rotation evaluates Intermediate against Beginners, Advanced against Intermediates, and Advanced under a fixed ordinary contract. Positive results are recorded in `docs/bot-evaluation.md`; broader strength evaluation, bounded plausible beginner mistakes, and calibrated Intermediate play remain.

Create Beginner, Intermediate, and Advanced strategy profiles by varying feature coverage, memory, inference, lookahead, and risk calibration. Tune against scenario suites and bot-versus-bot evaluation without teaching deliberate random mistakes.

**Exit:** levels show measurable decision-quality differences, remain legal and non-cheating, and retain human-readable reasons.

## Milestone 14: Polish And PWA

**Status:** In progress. The production build includes install metadata, generated raster app icons, a manifest, production-only service-worker registration, shell caching, and offline navigation fallback. Reduced-motion users bypass the deal animation and all CSS motion is collapsed; keyboard focus is explicit, card controls have localized accessible names, live status is announced, mobile overlays avoid primary actions, and browser coverage checks viewport overflow. Optional persisted action sounds are available but default off. Explicit install/offline automation, a complete WCAG audit, and broader visual regression coverage remain.

Refine card readability, typography, spacing, feedback, sound controls, reduced motion, accessibility, table animation, loading states, error recovery, manifest, service worker, installability, and offline startup.

**Exit:** visual regression checks pass on representative desktop and mobile viewports; install, update, offline, and resume flows are verified.

## Milestone 15: Human Multiplayer

**Status:** The first local playable room flow is implemented. Public named lobbies, link join, private seat tokens, automatic bot seats, host start/end, turn/disconnect deadlines, next-round bot replacement, cumulative scoring, chat, and responsive room UI run against a Cloudflare Worker and SQLite-backed Durable Object in local development. The Worker persists authoritative snapshots, validates indexed legal actions, and returns only each seat's projection without old card-play history. Browser and full-round API tests pass locally. Public deployment, production API configuration, free-quota observation, and broader reconnect/abuse testing remain; Cloudflare is not yet authenticated on this machine. See `docs/multiplayer.md`.

Build a separate authoritative service for four humans, private rooms, shareable invite links, reconnect, hidden-card projections, server validation, persistence, and abuse controls. Deliver the first playable room flow before native packaging. Select transport and hosting as part of this milestone.

**Exit:** four remote clients can reconnect to a server-validated game without receiving another seat's hidden information.

## Milestone 16: Native Packaging Evaluation

Validate the stable PWA inside Capacitor, identify native-only requirements, and add platform projects only if store distribution provides clear value.

**Exit:** a documented go/no-go decision includes maintenance and store-release costs.
