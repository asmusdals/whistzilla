# Whistzilla Session Handoff

Updated: 2026-08-21

## Current State

- Milestones 1-4 are complete; milestones 5-8 are complete for the `Almindelige` and `Gode` MVP paths in `docs/roadmap.md`.
- The browser app supports one human opening `Almindelige` or `Gode`, three bots, readable dealing/bidding timing, A/K/Q/J card labels, suit/rank hand sorting, contract setup, no exchange, 13 tricks, scoring, refresh/resume, replay review, coaching hints, cached post-move feedback, bot difficulty, and a first PWA shell.
- Run with `npm install` followed by `npm run dev`; the normal local URL is `http://127.0.0.1:5173/`.
- The implementation and documentation are saved in Git. Inspect `git status` before editing and preserve any later user changes.

## Verified Baseline

Last successful checks:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:run       # 13 files, 47 tests
npm run build
npm run test:e2e       # complete game on desktop + mobile
```

On this macOS 12 machine, Playwright uses locally installed Google Chrome because the current downloaded Chromium build does not support macOS 12. CI installs versioned Chromium on Linux. Starting Vite/Chrome may require sandbox approval.

## Important Boundaries

- `docs/game-rules.md` is authoritative. Ten rules remain marked `⚠️ AFKLARES`, but the product owner explicitly authorized implementation of the provisional/default behavior written under those flags on 2026-08-21. Keep it isolated and easy to replace; only a flag with no written default remains blocked.
- Temporary behavior is documented under `Development Rule Profile` in `docs/architecture.md`: no exchange, forced called partner card when its suit is first led, and no joker in place of a suit the player can follow.
- The UI exposes `Almindelige` and `Gode`. Next contract work may implement Halve, exchange, Vip, provisional self-partner scoring, and provisional lost-special scoring from the written defaults. Special-contract trump still needs an explicit provisional choice because rule 25 gives none.
- Bots use deterministic Beginner, Intermediate, or Advanced profiles in `packages/strategy`. Candidate analysis consumes only `PlayerView`, attaches structured reasons, and derives memory/renounces only from public events.
- Self-partner scoring currently returns `pending-self-partner-rule`; the next agent may replace it with the written provisional 3-versus-1 distribution. Vip and special-contract behavior are still unimplemented, not categorically blocked.

## Key Files

- `packages/game-core/src/game.ts`: state machine, bidding transitions, contract setup, legal play, tricks.
- `packages/game-core/src/scoring.ts`: confirmed Almindelige/Gode two-versus-two scoring.
- `apps/web/src/cards/presentation.ts`: international labels and deterministic hand ordering.
- `packages/game-core/src/perspective.ts`: hidden-information-safe player projection.
- `packages/strategy/src/index.ts`: perspective-safe practical bot decisions and structured reasons.
- `packages/coaching/src/index.ts`: progressive reports and pre-action comparison primitives.
- `apps/web/src/App.tsx`: complete current MVP flow and strategy-driven bot scheduler.
- `apps/web/public/`: PWA manifest, generated raster icons, and service worker.
- `e2e/foundation.spec.ts`: full Almindelige desktop and Gode mobile games plus timing, coaching, resume, settings, and replay.

## Recommended Resume Order

1. Read `AGENTS.md`, this file, and the status entries in `docs/roadmap.md`.
2. Run the verified baseline before editing; inspect `git status` and preserve any new changes after the saved checkpoint.
3. Treat `asmus_noter/noter.txt` as active product input and re-read it when resuming.
4. Add expert-approved bidding/play scenario fixtures and improve partnership tactics and probability-free inference.
5. Add explicit production PWA offline/update tests and an update-notification flow.
6. Add persistent assistance preferences and Guided mode.
7. Implement written provisional rules through named policy functions and focused tests. Do not erase the `⚠️ AFKLARES` markers.
8. Ask only where a flagged rule has no provisional/default behavior, currently most notably special-contract trump in section 25.

## Latest Saved Work

- Product-owner notes are implemented: readable deal/bidding timing, `A/K/Q/J`, deterministic suit/rank sorting, and bids beyond Almindelige.
- `Gode` is playable end to end with automatic clubs trump and doubled scoring.
- Coaching includes progressive hints, ranked alternatives, and post-move feedback cached before the human action.
- Desktop E2E completes Almindelige; mobile E2E completes Gode. Both cover dealing, bidding visibility, coaching, refresh/resume, settings, scoring, replay, and post-move review.

## Best Next Implementation Slice

1. Add a match/session aggregate around individual replayed rounds: cumulative four-seat scores and dealer rotation are confirmed by rules 1.2 and 2.2. Do not invent a match-ending threshold; allow continuous rounds.
2. Then implement provisional self-partner scoring through a named policy function and tests.
3. Then implement exchange as a selectable 0-3-card provisional policy before Halve/Vip contract setup.
