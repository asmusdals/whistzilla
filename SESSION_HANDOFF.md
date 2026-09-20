# Whistzilla Session Handoff

Updated: 2026-09-20

## Current State

- Milestones 1-8 are complete locally. Every numerical and special contract has
  an end-to-end path through bidding, setup, play, scoring, replay, and the next
  round.
- The responsive home screen links to Training and the points calculator.
  Multiplayer is the next major milestone. An in-memory authoritative room
  service now exists; transport, durable storage, invite links, and the web
  lobby are still to be built.
- The table supports readable deal/bid/trick timing, international card labels,
  deterministic suit/rank sorting, clockwise bidding, hidden exchange, partner
  reveal, special-contract play, cumulative four-seat scores, dealer rotation,
  refresh/resume, replay review, assistance modes, bot difficulty, and a PWA
  shell.
- Run with `npm install` followed by `npm run dev`; the normal local URL is
  `http://127.0.0.1:5173/`.
- The working tree contains the current all-contract implementation. Inspect
  `git status` before editing and preserve user changes.

## Verification Status

Verified on 2026-09-20:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:run       # 98 tests passed
npm run build
npm run test:e2e -- --project=desktop-chromium --grep 'super laydown'
```

The browser test required a local server bind outside the default sandbox.

## Important Boundaries

- `docs/game-rules.md` is authoritative. Eight rules remain marked
  `⚠️ AFKLARES`; the product owner authorized their written provisional defaults
  on 2026-08-21. Keep each policy isolated, documented, and tested until the
  player group confirms the final rule.
- Deterministic rules, legality, transitions, and scoring belong in
  `packages/game-core`; strategy and coaching consume projected `PlayerView`
  data and must never inspect unavailable hidden cards.
- Vip joker/exchange behavior, forced makkeres play, joker following-suit
  behavior, exchange count, setup order, and self-partner scoring remain
  provisional.
- Multiplayer remains non-interactive in the web client until the room service
  has transport, durable storage, and a lobby.

## Key Files

- `packages/game-core/src/game.ts`: state machine, contract setup, exchange,
  legal play, trick resolution, and round completion.
- `packages/game-core/src/scoring.ts`: numerical, special, team, and self-partner
  scoring policies.
- `packages/game-core/src/perspective.ts`: hidden-information-safe projections.
- `packages/strategy/src/index.ts`: deterministic perspective-safe bidding,
  exchange, play analysis, and difficulty profiles.
- `packages/coaching/src/index.ts`: progressive recommendations and pre-action
  comparison primitives.
- `apps/web/src/App.tsx`: home screen, table flow, bot scheduling, coaching,
  scoring, replay, and settings.
- `apps/web/src/persistence/gameStorage.ts`: resumable session and replay storage.
- `e2e/foundation.spec.ts`: representative desktop/mobile full-round coverage.
- `docs/roadmap.md`: current milestone status and remaining work.

## Recommended Resume Order

1. Follow `docs/git-workflow.md`: use review branches and push after completed
   tested slices. Avoid another large unpushed backlog.
2. Build the multiplayer transport, persistence, invite link lobby, and
   reconnect flow around the existing room service, with four-client leak tests.
3. Manually complete representative numerical, Vip, and special contracts on
   desktop and portrait mobile, including refresh/resume and next-round dealer
   rotation.
4. Create expert-approved bidding and card-play scenario fixtures. Use them to
   tune bot strategy and demonstrate measurable Beginner/Intermediate/Advanced
   quality differences.
5. Improve guided coaching and replay decision filtering.
6. Add explicit production install/offline/update tests, complete the WCAG audit,
   and broaden visual regression coverage.
7. Confirm the eight provisional rules with the player group without silently
   changing current behavior.

## Latest Product-Owner Notes Covered

- Slower, visible deal and bidding animation.
- `A/K/Q/J` labels and deterministic suit/rank hand ordering.
- Every bid family in compact type/level controls.
- Face-down exchange where discarded cards are chosen before replacement cards
  are revealed.
- A home screen with Training, Multiplayer, and Points calculator.
- The fourth played card remains visible before the next trick begins.
- Bidding advances strictly clockwise, skipping only players who have passed.

## Best Next Implementation Slice

Build the first playable multiplayer room flow as specified in
`docs/multiplayer.md`, checkpointing each tested slice on the review branch.
