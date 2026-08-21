# Whistzilla Agent Instructions

- Treat `docs/game-rules.md` as the authoritative rules source. Rules marked `⚠️ AFKLARES` may be implemented using the provisional/default behavior written in that section, as explicitly authorized by the product owner on 2026-08-21. Keep provisional behavior isolated, documented, and covered by focused tests so it can be changed later. If a flagged section gives no provisional behavior at all, document the missing decision instead of inventing one.
- Keep deterministic rules, state transitions, legality, trick resolution, and scoring in the framework-free game core. The core must not depend on React, browser APIs, storage, localization, or presentation code.
- Keep bot strategy, recommendations, explanations, and UI in separate layers with one-way dependencies toward the game core.
- Bots and coaching must never inspect hidden information unavailable to the player whose decision is being evaluated. Strategy-facing APIs must accept a projected player view, not full game state.
- Preserve the distinction between currently visible facts, recallable public history, certain deductions, probabilistic inferences, and inaccessible hidden information.
- Add or update automated tests for every rule change. Include negative cases and information-leak tests where relevant.
- Prefer small, reviewable implementation increments. Do not build later roadmap milestones speculatively.
- Run relevant type checks and tests before completing work, and report anything that could not be run.
- Record material changes to package boundaries, public interfaces, persistence formats, or multiplayer assumptions in `docs/architecture.md` and update `docs/roadmap.md` when sequencing changes.
- Treat `asmus_noter/noter.txt` as active product-owner input and re-read it at the start of implementation sessions.
