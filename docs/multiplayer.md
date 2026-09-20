# Human multiplayer

## Product decisions (2026-09-20)

- The multiplayer landing page lists named active tables. A shareable link opens
  a specific table. Anyone with the link may join; accounts and passwords are
  not required. Each visitor enters a gamertag.
- Seats are assigned clockwise in order of joining. The table creator starts
  the session. Every empty seat is played by an Intermediate bot, so one person
  can start immediately. A newcomer during a round waits for an available bot
  seat at the next round boundary.
- Scores persist across rounds and the dealer rotates after each completed
  round. The creator may end the session; if the creator leaves, another seated
  human becomes host. A completed round is shown briefly before the following
  one starts automatically.
- A player has 45 seconds per decision. On a card turn, timeout selects a
  random legal card; for bidding and setup the server chooses a legal bot
  action. A disconnected player's place remains reserved for one minute, then
  a bot takes over. The player can reconnect with a private local browser token
  and re-enter at the next round if the seat has been released.
- Chat is available in the lobby and at the table. Hints, coaching, and
  decision review are absent from multiplayer. The UI shows bids, scores,
  trick counts, and the current trick. Four cards from a completed trick remain
  visible for 2.5 seconds; old card-by-card trick history is not returned to
  multiplayer clients.
- The first deployment must use free plans only. Free quotas may temporarily
  interrupt service when exhausted; there is no automatic paid upgrade.

## Implemented boundaries

`@whistzilla/multiplayer` now provides `TableService`, a framework-free
authoritative session manager built on `GameState`, `applyCommand`,
`projectPlayerView`, and strategy decisions derived only from a bot's own
projection. It tracks room names, seats, private reconnect tokens, waiting
players, chat, round totals, dealer rotation, deadlines, and idle expiry. The
older `RoomService` remains for its original four-human test boundary; new
rooms use `TableService`.

`apps/multiplayer-api` wraps a single low-traffic `TableService` in a
SQLite-backed Cloudflare Durable Object. It stores a JSON snapshot after every
mutation, including all authoritative hands and private tokens. The Worker
uses HTTP endpoints for lobby, join, seat view, start, indexed legal action,
chat, and end. A Durable Object alarm handles deadlines when browsers are not
polling. The browser polls every five seconds and sends a legal-command index
and expected revision; the server maps that index to the current projected
legal command before applying it. The browser never submits arbitrary game
state or sees another player's unrevealed hand.

The UI is under `/multiplayer` and `/multiplayer/:tableId`. Local Vite
development proxies `/api/tables` to the Worker running at port 8787. A
production build enables the multiplayer home link only when
`VITE_MULTIPLAYER_API_URL` is set to the deployed Worker URL. Netlify remains
the static frontend host; Cloudflare Workers Free and Durable Objects Free are
the planned authoritative backend. The API URL is public configuration, while
each private seat token is stored only in that browser's local storage and
sent in an Authorization header. The invite link carries only the room ID.

The current snapshot is the recovery source after a Worker restart. The first
version does not expose replay history or persist an append-only command log.
The game core still handles all deterministic rule validation and scoring.

## Local verification and remaining deployment step

```sh
npm install
npm run dev --workspace @whistzilla/multiplayer-api
npm run dev -- --host 127.0.0.1
npm run test:e2e:multiplayer
node apps/multiplayer-api/smoke.mjs
```

The smoke script plays a full round with four seats, checks hidden hands in
every response (except a rule-authorized open declarer hand), scoring, chat,
and host end. The browser test covers two clients, bots in unfilled seats,
chat, and refresh on desktop and mobile. `TableService` unit tests cover
wrong-seat commands, timeout, disconnection, waiting, and brief trick display.

Cloudflare deployment still needs the product owner's free Cloudflare account
to be connected with `wrangler login`. `wrangler deploy --dry-run` builds the
Worker locally. Once connected, deploy `apps/multiplayer-api`, set the Netlify
build variable `VITE_MULTIPLAYER_API_URL` to its Worker URL, and deploy the web
branch. Do not merge the client to production with an unset API URL and expect
multiplayer to work. Verify the free plan and usage limits in the dashboard
before public launch. Current provider references:

- [Cloudflare Durable Objects Free pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Netlify Free pricing](https://www.netlify.com/pricing/)
