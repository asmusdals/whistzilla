import {
  applyCommand,
  contractSetupActor,
  createGame,
  projectPlayerView,
  SEATS,
  type GameCommand,
  type GameState,
  type PlayedCard,
  type PlayerView,
  type Seat,
} from '@whistzilla/game-core';
import { chooseStrategyAction } from '@whistzilla/strategy';

const TURN_MS = 45_000;
const RECONNECT_MS = 60_000;
const ROUND_PAUSE_MS = 8_000;
const ROOM_IDLE_MS = 24 * 60 * 60 * 1000;

export interface TablePlayer {
  readonly tag: string;
  readonly token: string;
  lastSeenAt: number;
  lastChatAt: number | null;
}

export interface ChatMessage {
  readonly id: string;
  readonly tag: string;
  readonly text: string;
  readonly at: number;
}

export interface TableRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  updatedAt: number;
  status: 'lobby' | 'playing' | 'finished';
  hostToken: string;
  seats: [
    TablePlayer | null,
    TablePlayer | null,
    TablePlayer | null,
    TablePlayer | null,
  ];
  waiting: TablePlayer[];
  game: GameState | null;
  round: number;
  scores: [number, number, number, number];
  turnStartedAt: number;
  roundFinishedAt: number | null;
  lastTrickAt: number | null;
  messages: ChatMessage[];
}

export interface TableSummary {
  readonly id: string;
  readonly name: string;
  readonly status: TableRecord['status'];
  readonly round: number;
  readonly humanCount: number;
  readonly waitingCount: number;
  readonly createdAt: number;
}

export interface TableView {
  readonly table: TableSummary;
  readonly seat: Seat | null;
  readonly isHost: boolean;
  readonly players: readonly {
    readonly seat: Seat;
    readonly tag: string;
    readonly connected: boolean;
    readonly isBot: boolean;
  }[];
  readonly scores: readonly [number, number, number, number];
  readonly game: PlayerView | null;
  readonly recentTrick: readonly PlayedCard[];
  readonly turnDeadline: number | null;
  readonly messages: readonly ChatMessage[];
}

export type TableError =
  | 'table-not-found'
  | 'seat-not-found'
  | 'table-finished'
  | 'not-host'
  | 'not-started'
  | 'wrong-seat'
  | 'invalid-input'
  | 'already-joined'
  | 'not-your-turn'
  | 'stale-command';

export type TableResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const ok = <T>(value: T): TableResult<T> => ({ ok: true, value });
const fail = <T>(error: string): TableResult<T> => ({ ok: false, error });

function token(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] ?? 0;
}

function actor(game: GameState): Seat | null {
  if (game.phase === 'bidding') return game.bidding.actor;
  if (game.phase === 'trick-play') return game.trickPlay.actor;
  if (game.phase === 'contract-setup') return contractSetupActor(game);
  return null;
}

function publicSummary(table: TableRecord): TableSummary {
  return {
    id: table.id,
    name: table.name,
    status: table.status,
    round: table.round,
    humanCount: table.seats.filter(Boolean).length,
    waitingCount: table.waiting.length,
    createdAt: table.createdAt,
  };
}

function cleanName(value: string, max: number): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= max ? name : null;
}

// One authoritative instance owns the collection of low-traffic public rooms.
// Its JSON snapshot is persisted by the transport after every mutation.
export class TableService {
  private readonly tables: Map<string, TableRecord>;

  constructor(snapshot: readonly TableRecord[] = []) {
    this.tables = new Map(snapshot.map((table) => [table.id, table]));
  }

  snapshot(): readonly TableRecord[] {
    return [...this.tables.values()];
  }

  list(now: number): readonly TableSummary[] {
    this.expire(now);
    return [...this.tables.values()]
      .filter((table) => table.status !== 'finished')
      .map(publicSummary)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  create(
    name: string,
    tag: string,
    now: number,
  ): TableResult<{
    readonly id: string;
    readonly token: string;
    readonly seat: Seat;
  }> {
    const roomName = cleanName(name, 40);
    const gamertag = cleanName(tag, 20);
    if (!roomName || !gamertag) return fail('invalid-input');
    if (this.list(now).length >= 20 || this.tables.size >= 100)
      return fail('too-many-tables');
    const id = crypto.randomUUID();
    const seatToken = token();
    this.tables.set(id, {
      id,
      name: roomName,
      createdAt: now,
      updatedAt: now,
      status: 'lobby',
      hostToken: seatToken,
      seats: [
        { tag: gamertag, token: seatToken, lastSeenAt: now, lastChatAt: null },
        null,
        null,
        null,
      ],
      waiting: [],
      game: null,
      round: 0,
      scores: [0, 0, 0, 0],
      turnStartedAt: now,
      roundFinishedAt: null,
      lastTrickAt: null,
      messages: [],
    });
    return ok({ id, token: seatToken, seat: 0 });
  }

  join(
    id: string,
    tag: string,
    now: number,
  ): TableResult<{
    readonly token: string;
    readonly seat: Seat | null;
  }> {
    const table = this.tables.get(id);
    const gamertag = cleanName(tag, 20);
    if (!table) return fail('table-not-found');
    if (table.status === 'finished') return fail('table-finished');
    if (!gamertag) return fail('invalid-input');
    if (table.waiting.length >= 16) return fail('room-full');
    if (
      [...table.seats, ...table.waiting].some(
        (player) =>
          player?.tag.toLocaleLowerCase('da') ===
          gamertag.toLocaleLowerCase('da'),
      )
    )
      return fail('already-joined');
    const seatToken = token();
    const player = {
      tag: gamertag,
      token: seatToken,
      lastSeenAt: now,
      lastChatAt: null,
    };
    const seat =
      table.status === 'lobby'
        ? SEATS.find((candidate) => table.seats[candidate] === null)
        : undefined;
    if (seat !== undefined) table.seats[seat] = player;
    else table.waiting.push(player);
    table.updatedAt = now;
    return ok({ token: seatToken, seat: seat ?? null });
  }

  view(id: string, seatToken: string, now: number): TableResult<TableView> {
    const table = this.tables.get(id);
    if (!table) return fail('table-not-found');
    const seat = SEATS.find(
      (candidate) => table.seats[candidate]?.token === seatToken,
    );
    const waiting = table.waiting.find((player) => player.token === seatToken);
    if (seat === undefined && !waiting) return fail('seat-not-found');
    const player = seat === undefined ? waiting! : table.seats[seat]!;
    player.lastSeenAt = now;
    table.updatedAt = now;
    const projected =
      seat === undefined || !table.game
        ? null
        : projectPlayerView(table.game, seat);
    // Past played cards remain server-side for the bots' public-memory model.
    // The multiplayer UI receives current/briefly completed tricks, not a
    // browsable card history.
    const game = projected && {
      ...projected,
      publicEvents: projected.publicEvents.filter(
        (event) => event.type !== 'card-played',
      ),
    };
    const currentActor = table.game ? actor(table.game) : null;
    return ok({
      table: publicSummary(table),
      seat: seat ?? null,
      isHost: table.hostToken === seatToken,
      players: SEATS.map((place) => ({
        seat: place,
        tag: table.seats[place]?.tag ?? 'Bot',
        connected:
          !!table.seats[place] &&
          now - table.seats[place].lastSeenAt < RECONNECT_MS,
        isBot: !table.seats[place],
      })),
      scores: table.scores,
      game,
      recentTrick:
        table.game &&
        table.lastTrickAt !== null &&
        now - table.lastTrickAt < 2_500
          ? (table.game.trickPlay.completedTricks.at(-1)?.cards ?? [])
          : [],
      turnDeadline:
        currentActor === null ? null : table.turnStartedAt + TURN_MS,
      messages: table.messages.slice(-50),
    });
  }

  start(id: string, seatToken: string, now: number): TableResult<true> {
    const table = this.tables.get(id);
    if (!table) return fail('table-not-found');
    if (table.hostToken !== seatToken) return fail('not-host');
    if (table.status !== 'lobby') return fail('not-started');
    table.status = 'playing';
    table.round = 1;
    table.game = createGame({ seed: randomSeed(), dealer: 3, host: 0 });
    table.turnStartedAt = now;
    table.updatedAt = now;
    this.runBots(table, now);
    return ok(true);
  }

  submit(
    id: string,
    seatToken: string,
    command: GameCommand,
    now: number,
  ): TableResult<true> {
    const table = this.tables.get(id);
    if (!table) return fail('table-not-found');
    const seat = SEATS.find(
      (candidate) => table.seats[candidate]?.token === seatToken,
    );
    if (seat === undefined) return fail('seat-not-found');
    if (table.status !== 'playing' || !table.game) return fail('not-started');
    if (command.actor !== seat) return fail('wrong-seat');
    if (actor(table.game) !== seat) return fail('not-your-turn');
    const applied = applyCommand(table.game, command);
    if (!applied.ok) return fail(applied.error.code);
    table.game = applied.state;
    table.updatedAt = now;
    this.afterAction(
      table,
      applied.events.some((event) => event.type === 'trick-won'),
      now,
    );
    this.runBots(table, now);
    return ok(true);
  }

  chat(
    id: string,
    seatToken: string,
    text: string,
    now: number,
  ): TableResult<ChatMessage> {
    const table = this.tables.get(id);
    if (!table) return fail('table-not-found');
    const player =
      table.seats.find((candidate) => candidate?.token === seatToken) ??
      table.waiting.find((candidate) => candidate.token === seatToken);
    if (!player) return fail('seat-not-found');
    if (table.status === 'finished') return fail('table-finished');
    const clean = text.trim();
    if (!clean || clean.length > 300) return fail('invalid-input');
    if (player.lastChatAt !== null && now - player.lastChatAt < 1_000)
      return fail('rate-limited');
    player.lastChatAt = now;
    const message = {
      id: crypto.randomUUID(),
      tag: player.tag,
      text: clean,
      at: now,
    };
    table.messages.push(message);
    table.messages = table.messages.slice(-50);
    table.updatedAt = now;
    return ok(message);
  }

  end(id: string, seatToken: string, now: number): TableResult<true> {
    const table = this.tables.get(id);
    if (!table) return fail('table-not-found');
    if (table.hostToken !== seatToken) return fail('not-host');
    table.status = 'finished';
    table.updatedAt = now;
    return ok(true);
  }

  tick(now: number): void {
    this.expire(now);
    for (const table of this.tables.values()) {
      if (table.status !== 'playing' || !table.game) continue;
      for (const seat of SEATS) {
        const player = table.seats[seat];
        if (player && now - player.lastSeenAt >= RECONNECT_MS) {
          table.seats[seat] = null;
          table.waiting.unshift(player);
          table.updatedAt = now;
        }
      }
      if (
        table.seats.every((player) => player === null) &&
        !table.waiting.some((player) => now - player.lastSeenAt < RECONNECT_MS)
      ) {
        table.status = 'finished';
        table.updatedAt = now;
        continue;
      }
      if (!table.seats.some((player) => player?.token === table.hostToken)) {
        const nextHost = table.seats.find((player) => player !== null);
        if (nextHost) table.hostToken = nextHost.token;
      }
      if (table.game.phase === 'scoring') {
        if (
          table.roundFinishedAt !== null &&
          now - table.roundFinishedAt >= ROUND_PAUSE_MS
        )
          this.nextRound(table, now);
        continue;
      }
      this.runBots(table, now);
      const afterBots = table.game as GameState | null;
      if (!afterBots || afterBots.phase === 'scoring') continue;
      const current = actor(afterBots);
      if (current === null || !table.seats[current]) continue;
      if (now - table.turnStartedAt < TURN_MS) continue;
      const view = projectPlayerView(afterBots, current);
      const legal = view.legalCommands;
      const playCards = legal.filter((command) => command.type === 'play-card');
      const fallback =
        playCards.length > 0
          ? playCards[
              Math.floor((randomSeed() / 4294967296) * playCards.length)
            ]
          : chooseStrategyAction(view, 'intermediate')?.command;
      if (!fallback) continue;
      const applied = applyCommand(afterBots, fallback);
      if (!applied.ok) continue;
      table.game = applied.state;
      table.updatedAt = now;
      this.afterAction(
        table,
        applied.events.some((event) => event.type === 'trick-won'),
        now,
      );
      this.runBots(table, now);
    }
  }

  nextDeadline(now: number): number | null {
    let earliest = Infinity;
    for (const table of this.tables.values()) {
      if (table.status !== 'playing' || !table.game) continue;
      for (const player of table.seats)
        if (player)
          earliest = Math.min(earliest, player.lastSeenAt + RECONNECT_MS);
      if (table.game.phase === 'scoring' && table.roundFinishedAt !== null)
        earliest = Math.min(earliest, table.roundFinishedAt + ROUND_PAUSE_MS);
      else if (table.game.phase !== 'scoring') {
        const current = actor(table.game);
        if (current !== null && table.seats[current])
          earliest = Math.min(earliest, table.turnStartedAt + TURN_MS);
        if (table.lastTrickAt !== null && now - table.lastTrickAt < 2_500)
          earliest = Math.min(earliest, table.lastTrickAt + 2_500);
      }
    }
    return Number.isFinite(earliest) ? Math.max(now + 500, earliest) : null;
  }

  private runBots(table: TableRecord, now: number): void {
    if (!table.game) return;
    if (table.lastTrickAt !== null && now - table.lastTrickAt < 2_500) return;
    for (
      let moves = 0;
      moves < 180 && table.game.phase !== 'scoring';
      moves += 1
    ) {
      const seat = actor(table.game);
      if (seat === null || table.seats[seat]) return;
      const decision = chooseStrategyAction(
        projectPlayerView(table.game, seat),
        'intermediate',
      );
      if (!decision) return;
      const applied = applyCommand(table.game, decision.command);
      if (!applied.ok) return;
      table.game = applied.state;
      table.updatedAt = now;
      this.afterAction(
        table,
        applied.events.some((event) => event.type === 'trick-won'),
        now,
      );
    }
  }

  private afterAction(
    table: TableRecord,
    completedTrick: boolean,
    now: number,
  ): void {
    table.turnStartedAt = now;
    if (completedTrick) table.lastTrickAt = now;
    if (
      table.game?.phase === 'scoring' &&
      table.game.score &&
      table.roundFinishedAt === null
    ) {
      table.scores = table.scores.map(
        (score, seat) => score + table.game!.score!.deltas[seat]!,
      ) as typeof table.scores;
      table.roundFinishedAt = now;
    }
  }

  private nextRound(table: TableRecord, now: number): void {
    if (!table.game) return;
    for (const seat of SEATS) {
      if (table.seats[seat]) continue;
      const waitingIndex = table.waiting.findIndex(
        (player) => now - player.lastSeenAt < RECONNECT_MS,
      );
      const next =
        waitingIndex < 0 ? undefined : table.waiting.splice(waitingIndex, 1)[0];
      if (next) table.seats[seat] = next;
    }
    table.round += 1;
    table.game = createGame({
      seed: randomSeed(),
      dealer: ((table.game.dealer + 1) % 4) as Seat,
      host: 0,
    });
    table.roundFinishedAt = null;
    table.lastTrickAt = null;
    table.turnStartedAt = now;
    table.updatedAt = now;
    this.runBots(table, now);
  }

  private expire(now: number): void {
    for (const [id, table] of this.tables)
      if (now - table.updatedAt > ROOM_IDLE_MS) this.tables.delete(id);
  }
}
