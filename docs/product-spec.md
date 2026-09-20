# Whistzilla Product Specification

## Status

Initial product definition. `game-rules.md` is authoritative. Confirmed sections are permanent behavior; a `⚠️ AFKLARES` section may use its written provisional/default behavior under the product-owner mandate dated 2026-08-21 and remains subject to later revision.

## Product Goal

Whistzilla is a polished Whist game and learning application for exactly four players. The initial product supports one human and three bots on desktop and mobile web. It must be enjoyable without coaching and capable of teaching stronger practical play when assistance is enabled.

Product-owner notes in `asmus_noter/noter.txt` are active product requirements. The UI must make dealing and bidding actions readable, label court cards as `A/K/Q/J`, group each suit in descending rank order, and progressively support bids beyond `Almindelige` whenever their authoritative rules can be enforced without guessing.

Human online multiplayer, accounts, authentication, shared cloud saves, and server infrastructure are later features and are not part of the initial product.

## Audience And Language

- New players learning rules and basic patterns.
- Recreational players improving memory, inference, bidding, and card play.
- Experienced players wanting challenging practical bots and decision review.
- Danish is the first UI and coaching language. All user-facing terms and explanations must use localization keys so another language can be added without changing strategy logic.

## Product Principles

1. Rules are deterministic, authoritative, and enforced independently of the UI.
2. Bots and coaching reason from legitimate player information and never cheat.
3. Recommendations teach a thought process rather than only naming an action.
4. Assistance is optional and should not obstruct ordinary table play.
5. Bot difficulty represents different quality of reasoning, not arbitrary mistakes.
6. Desktop and portrait-phone play are first-class experiences from the first playable UI.

## Initial Game Experience

- A Whistzilla home screen routes to Training, a shared-rules points calculator,
  and a clearly labelled future Multiplayer area.
- The points calculator covers every numerical and special contract supported by
  the core, including Vip reveal count and provisional one-against-three deltas.
- Exactly four seats: one human and three bots.
- A complete local game from deal through scoring, once all rules are specified.
- Clear bidding and card-play controls that allow only legal actions.
- Readable cards, strong touch targets, keyboard support where appropriate, and restrained interaction feedback.
- Local settings, automatic game resume, and completed replay logs without an account.
- Persisted cumulative point accounting and dealer rotation across completed rounds.
- Deterministic replay of a recorded game for debugging and learning.

## Assistance Modes

### No Assistance

Normal play without proactive recommendations. A completed decision can be reviewed afterwards.

### Hint Mode

The player requests help before acting. Guidance should be progressive: first relevant considerations, then stronger direction, and only then an exact recommendation when requested.

### Guided Mode

The application may unobtrusively indicate that a decision deserves more thought. It must not block or repeatedly interrupt normal play.

### Training Mode

The interface may show a recommended action, credible alternatives, relative quality, relevant knowledge, uncertainty, and a structured explanation before the player acts.

After a committed action, coaching may compare it with the engine preference using the report computed before that action. Training does not permit undo; assisted decisions remain part of the game and replay.

## Card Memory And Information

Played cards are public and legitimately knowable, but remembering them is a learning skill. Whistzilla therefore stores complete public history while separately controlling how much history the UI resurfaces:

- No assistance can keep history out of the immediate table view.
- Hint and guided modes can reveal relevant remembered facts progressively.
- Training and replay can present full public history and derived card tracking.
- Inferences must be labelled as likely or uncertain rather than presented as facts.

No assistance mode may reveal cards that were never visible to the evaluated player.

## Coaching Presentation

- Desktop: optional side panel that can collapse without changing the table layout.
- Phone: bottom sheet with compact summaries and expandable detail.
- Hints: staged disclosure rather than immediate card highlighting.
- Training: candidate highlighting and comparison are allowed.
- Review: a decision timeline reconstructs what was knowable at each point.
- Explanations use concise headline reasons with optional evidence and deeper detail.

## Quality Requirements

- Core games are reproducible from their seed and action log.
- A game remains playable after refresh through local persistence.
- All controls fit and remain usable at representative desktop and portrait-phone sizes.
- Animations never obscure state changes and respect reduced-motion preferences.
- Color is not the sole carrier of suit, legality, recommendation quality, or status.
- Strategy output is legal, deterministic for a fixed view/profile/seed, and explainable.
- Automated tests guard rules and hidden-information boundaries.

## Non-Goals For The Initial Local-Training Milestones

- Human online multiplayer or spectators.
- Accounts, authentication, cloud sync, leaderboards, or social systems.
- A general-purpose backend or database.
- Theoretically perfect play, heavyweight Monte Carlo search, or machine learning.
- Native iOS or Android projects before the web PWA is stable.

The Multiplayer entry on the home screen remains informational until the next
major milestone delivers a playable authoritative room flow; see
`docs/multiplayer.md`.

## Open Product Decisions

- Whether replay review reveals all hands immediately after a game or only on demand.
- Whether difficulty is selected once for all opponents or independently per seat.
- Accessibility targets beyond WCAG 2.2 AA as the baseline design goal.
