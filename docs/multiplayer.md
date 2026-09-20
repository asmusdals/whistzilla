# Human multiplayer: first playable room

Product-owner input (2026-09-19): players should be able to share a link and
join the same game with other humans. This is the next major milestone before
native packaging. The existing Training route remains a local bot game until
the room flow is playable end to end.

## First delivery slice

1. Create a private four-seat room on an authoritative service. Return a
   shareable invite URL containing only an opaque room identifier. The link
   opens a lobby where a visitor claims an available seat.
2. Issue each seated player a separate unguessable reconnect token. Keep the
   token out of the invite URL so sharing the room never shares a seat or hand.
3. Start after four humans have joined. The server creates the seeded
   `GameState`, validates each versioned `GameCommand` through `applyCommand`,
   and rejects stale revisions and wrong-seat actions.
4. Send each client `projectPlayerView(state, seat)` and public events only.
   Never send raw `GameState`, other hands, unrevealed kitty cards, or private
   commands. A reconnect obtains a fresh projection and public event cursor.
5. Persist a snapshot plus accepted command log per room, with expiry and an
   idempotent revision key. A server restart must not change the game or seat
   ownership. Add rate limits and room cleanup before public deployment.
6. Test four browsers joining through one link, a complete round, reconnect,
   stale and wrong-seat commands, and byte-level absence of hidden cards in
   responses to each seat.

## Boundaries and open deployment work

The current Netlify setup serves a static Vite client. A separate service and
durable store must be selected and deployed for rooms; a frontend-only invite
link cannot synchronize or protect four players' cards. The service consumes
the existing framework-free core. Transport choice (WebSocket or event stream
plus POST), hosting, storage, and room expiry should be selected when the first
server slice is built and recorded in `docs/architecture.md`.

The initial `@whistzilla/multiplayer` package implements the synchronous room
boundary in memory and tests seat ownership, stale revisions, and per-seat
information isolation. It is not a deployed service: process restarts currently
lose rooms, and there is no HTTP endpoint or join link yet. The next slice
should wrap this boundary in durable storage and a transport, then wire the
existing home entry to a room lobby.

The `PlayerView` contract must remain the sole game data sent to a seat. Any
new public information rule, including the revised Super bordlægger exposure,
must be enforced in `game-core` projections and covered by leak tests before
the multiplayer service is opened to external clients.
