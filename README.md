# Whistzilla

Whistzilla is a four-player Whist game and learning application. The repository is currently at the project-foundation milestone; gameplay is not implemented yet.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Development

```sh
npm install
npm run dev
```

The local Vite URL is printed in the terminal.

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

Do not implement unresolved game behavior by assuming rules from another Whist variant.
