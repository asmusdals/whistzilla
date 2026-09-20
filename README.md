# Whistzilla

Whistzilla is a four-player Whist game and learning application. The current
local version supports complete rounds against three bots, every documented
contract family, contract setup and exchange, scoring, local resume and replay,
coaching modes, a points calculator, and an installable PWA shell.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Development

```sh
npm install
npm run dev
```

The local Vite URL is printed in the terminal. By default it is normally
`http://127.0.0.1:5173/`.

## Quality Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
```

Playwright uses a locally installed Google Chrome outside CI. GitHub Actions installs its versioned Chromium build.

## Documentation

- `docs/game-rules.md` is the authoritative rules source.
- `docs/product-spec.md` defines the product behavior and boundaries.
- `docs/architecture.md` defines package boundaries and information safety.
- `docs/roadmap.md` defines the implementation sequence.

The current implementation uses the explicitly documented provisional policies
for rules marked `⚠️ AFKLARES`. Do not silently replace those policies or assume
rules from another Whist variant.
