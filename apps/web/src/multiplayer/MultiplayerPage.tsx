import type {
  Bid,
  Card,
  GameCommand,
  PlayerView,
  Seat,
} from '@whistzilla/game-core';
import type { TableView } from '@whistzilla/multiplayer/tables';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CARD_RANK_LABELS, compareHandCards } from '../cards/presentation';
import { CardVisual } from '../cards/CardVisual';
import { multiplayerApi, savedToken, saveToken } from './api';
import './multiplayer.css';

const suitSymbol = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
} as const;
const suitName = {
  clubs: 'Klør',
  diamonds: 'Ruder',
  hearts: 'Hjerter',
  spades: 'Spar',
} as const;
const bidName = {
  ordinary: 'almindelige',
  halves: 'halve',
  good: 'gode',
  vip: 'vip',
  sol: 'Sol',
  'pure-sol': 'Ren sol',
  'open-laydown': 'Bordlægger',
  'super-laydown': 'Super bordlægger',
} as const;

const bidLabel = (bid: Bid) =>
  bid.kind === 'numerical'
    ? `${bid.level} ${bidName[bid.bidType]}`
    : bidName[bid.bidType];

const cardLabel = (card: Card) =>
  card.kind === 'joker'
    ? `Joker ${card.number}`
    : `${CARD_RANK_LABELS[card.rank]}${suitSymbol[card.suit]}`;

const cardIdLabel = (id: string) => {
  const [suit, rank] = id.split(':');
  if (suit === 'joker') return `Joker ${rank}`;
  return `${CARD_RANK_LABELS[rank as keyof typeof CARD_RANK_LABELS] ?? rank}${suitSymbol[suit as keyof typeof suitSymbol] ?? ''}`;
};

const errorLabel: Record<string, string> = {
  'service-unavailable': 'Spilserveren svarer ikke. Prøv igen om lidt.',
  'table-not-found': 'Bordet findes ikke længere.',
  'seat-not-found': 'Din plads kunne ikke findes. Du kan tilslutte dig igen.',
  'not-host': 'Kun den, der oprettede bordet, kan gøre det.',
  'stale-command': 'Spillet nåede at gå videre. Vælg igen.',
  'not-your-turn': 'Det er ikke din tur.',
  'invalid-input': 'Kontrollér navn og besked.',
  'already-joined': 'Det gamertag bruges allerede ved bordet.',
  'room-full': 'Ventelisten er fuld.',
  'too-many-tables': 'Der er allerede mange aktive borde. Prøv et af dem.',
  'rate-limited': 'Vent et øjeblik, før du sender igen.',
};

function describeError(error: unknown) {
  const key = error instanceof Error ? error.message : 'service-unavailable';
  return errorLabel[key] ?? `Handlingen kunne ikke udføres (${key}).`;
}

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function MultiplayerLobbyPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<
    Awaited<ReturnType<typeof multiplayerApi.list>>['tables']
  >([]);
  const [tag, setTag] = useState(
    () => window.localStorage.getItem('whistzilla-gamertag') ?? '',
  );
  const [name, setName] = useState('Fredagswhist');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTables((await multiplayerApi.list()).tables);
      setError('');
    } catch (cause) {
      setError(describeError(cause));
    }
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      const result = await multiplayerApi.create(name, tag);
      window.localStorage.setItem('whistzilla-gamertag', tag.trim());
      saveToken(result.id, result.token);
      void navigate(`/multiplayer/${result.id}`);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="multi-page">
      <header className="multi-header">
        <Link to="/">← Whistzilla</Link>
        <h1>Multiplayer</h1>
      </header>
      <p className="multi-intro">
        Find et bord, eller opret dit eget. Et delt link åbner bordet direkte.
      </p>
      <label className="multi-field">
        Dit gamertag
        <input
          value={tag}
          maxLength={20}
          onChange={(event) => setTag(event.target.value)}
          placeholder="Skriv dit navn"
        />
      </label>
      <section className="multi-panel" aria-labelledby="create-table-heading">
        <h2 id="create-table-heading">Opret et bord</h2>
        <label className="multi-field">
          Bordets navn
          <input
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          className="multi-primary"
          disabled={busy || tag.trim().length < 2 || name.trim().length < 2}
          onClick={() => void create()}
        >
          Opret bord
        </button>
      </section>
      <section className="multi-panel" aria-labelledby="open-tables-heading">
        <h2 id="open-tables-heading">Aktive borde</h2>
        {tables.length === 0 && <p>Der er ingen aktive borde endnu.</p>}
        <div className="multi-table-list">
          {tables.map((table) => (
            <Link
              key={table.id}
              to={`/multiplayer/${table.id}`}
              className="multi-table-link"
            >
              <strong>{table.name}</strong>
              <span>
                {table.status === 'lobby' ? 'Lobby' : `Runde ${table.round}`} ·{' '}
                {table.humanCount} spillere · {table.waitingCount} i kø
              </span>
            </Link>
          ))}
        </div>
      </section>
      {error && (
        <p className="multi-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

function ActionControls({
  game,
  submit,
  busy,
}: {
  readonly game: PlayerView;
  readonly submit: (index: number) => Promise<void>;
  readonly busy: boolean;
}) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [selectedType, setSelectedType] = useState<Bid['bidType']>('ordinary');
  const [selectedLevel, setSelectedLevel] = useState(7);
  const legal = game.legalCommands;
  const bids = legal.flatMap((command, index) =>
    command.type === 'place-bid' ? [{ command, index }] : [],
  );
  const plays = legal.flatMap((command, index) =>
    command.type === 'play-card' ? [{ command, index }] : [],
  );
  const exchanges = legal.flatMap((command, index) =>
    command.type === 'exchange-cards' ? [{ command, index }] : [],
  );
  const exchangeCounts = [
    ...new Set(exchanges.map(({ command }) => command.discardedCardIds.length)),
  ];
  const matchingExchange = exchanges.find(
    ({ command }) =>
      command.discardedCardIds.length === selected.length &&
      command.discardedCardIds.every((id) => selected.includes(id)),
  );
  const simple = legal.flatMap((command, index) =>
    command.type !== 'place-bid' &&
    command.type !== 'play-card' &&
    command.type !== 'exchange-cards'
      ? [{ command, index }]
      : [],
  );
  const availableTypes = Object.keys(bidName).filter((type) =>
    bids.some(({ command }) => command.bid.bidType === type),
  ) as Bid['bidType'][];
  const effectiveType = availableTypes.includes(selectedType)
    ? selectedType
    : availableTypes[0];
  const levels: number[] = bids.flatMap(({ command }) =>
    command.bid.kind === 'numerical' && command.bid.bidType === effectiveType
      ? [command.bid.level]
      : [],
  );
  const effectiveLevel = levels.includes(selectedLevel)
    ? selectedLevel
    : levels[0];
  const selectedBid = bids.find(({ command }) =>
    command.bid.kind === 'numerical'
      ? command.bid.bidType === effectiveType &&
        command.bid.level === effectiveLevel
      : command.bid.bidType === effectiveType,
  );
  const pass = simple.find(({ command }) => command.type === 'pass');
  const otherActions = simple.filter(({ command }) => command.type !== 'pass');

  return (
    <section
      className="hand-area multi-hand-area"
      aria-label="Din hånd og dine handlinger"
    >
      <div className="hand">
        {[...game.ownHand].sort(compareHandCards).map((card) => {
          const play = plays.find(({ command }) => command.cardId === card.id);
          const selecting = exchanges.length > 0;
          const isSelected = selected.includes(card.id);
          return (
            <button
              type="button"
              className={`hand-card ${isSelected ? 'selected-exchange-card' : ''}`}
              key={card.id}
              aria-label={`${selecting ? 'Vælg' : 'Spil'} ${cardLabel(card)}`}
              aria-pressed={selecting ? isSelected : undefined}
              disabled={busy || (!play && !selecting)}
              onClick={() => {
                if (selecting) {
                  setSelected((current) =>
                    current.includes(card.id)
                      ? current.filter((id) => id !== card.id)
                      : current.length < Math.max(...exchangeCounts)
                        ? [...current, card.id]
                        : current,
                  );
                } else if (play) void submit(play.index);
              }}
            >
              <CardVisual card={card} />
            </button>
          );
        })}
      </div>
      {bids.length > 0 && (
        <div className="bid-controls">
          <label>
            <span>Type</span>
            <select
              aria-label="Meldingstype"
              value={effectiveType ?? ''}
              onChange={(event) =>
                setSelectedType(event.target.value as Bid['bidType'])
              }
            >
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {bidName[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Niveau</span>
            <select
              aria-label="Meldingsniveau"
              value={effectiveLevel ?? ''}
              disabled={!levels.length}
              onChange={(event) => setSelectedLevel(Number(event.target.value))}
            >
              {levels.length ? (
                levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))
              ) : (
                <option value="">—</option>
              )}
            </select>
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={busy || !selectedBid}
            onClick={() => selectedBid && void submit(selectedBid.index)}
          >
            Meld
          </button>
          {pass && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(pass.index)}
            >
              Pas
            </button>
          )}
        </div>
      )}
      {bids.length === 0 && pass && (
        <div className="bid-controls">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(pass.index)}
          >
            Pas
          </button>
        </div>
      )}
      {otherActions.length > 0 && (
        <div className="multi-simple-actions">
          {otherActions.map(({ command, index }) => (
            <button
              key={index}
              disabled={busy}
              onClick={() => void submit(index)}
            >
              {commandLabel(command)}
            </button>
          ))}
        </div>
      )}
      {exchanges.length > 0 && (
        <div className="multi-exchange">
          <p>
            Vælg kort, du vil bytte. Mulige antal: {exchangeCounts.join(', ')}.
          </p>
          <button
            disabled={busy || !matchingExchange}
            onClick={() =>
              matchingExchange && void submit(matchingExchange.index)
            }
          >
            Byt {selected.length} kort
          </button>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])}>Ryd valg</button>
          )}
        </div>
      )}
      {!legal.length && (
        <div className="waiting-label">Venter på den næste spiller…</div>
      )}
      {plays.length > 0 && (
        <div className="play-guidance">Vælg et fremhævet kort fra din hånd</div>
      )}
    </section>
  );
}

function commandLabel(command: GameCommand): string {
  switch (command.type) {
    case 'pass':
      return 'Pas';
    case 'choose-trump':
      return `Vælg ${suitName[command.trump]} som trumf`;
    case 'call-partner':
      return `Kald ${cardIdLabel(command.cardId)}`;
    case 'skip-exchange':
      return 'Byt ingen kort';
    case 'reveal-vip-card':
      return 'Vend næste byttekort';
    case 'stop-vip':
      return 'Stop Vip';
    default:
      return command.type;
  }
}

function Chat({
  view,
  send,
}: {
  readonly view: TableView;
  readonly send: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  return (
    <details className="multi-panel multi-chat" aria-label="Bordchat">
      <summary>
        Chat{' '}
        {view.messages.length > 0 && (
          <span>· {view.messages.length} beskeder</span>
        )}
      </summary>
      <div className="multi-messages" role="log" aria-live="polite">
        {view.messages.map((message) => (
          <p key={message.id}>
            <strong>{message.tag}:</strong> {message.text}
          </p>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          void send(text).then(() => setText(''));
        }}
      >
        <input
          value={text}
          maxLength={300}
          onChange={(event) => setText(event.target.value)}
          aria-label="Skriv besked"
          placeholder="Skriv til bordet"
        />
        <button disabled={!text.trim()}>Send</button>
      </form>
    </details>
  );
}

function relativeSeat(seat: Seat, viewer: Seat): Seat {
  return ((seat - viewer + 4) % 4) as Seat;
}

function currentActor(game: PlayerView): Seat | null {
  if (game.phase === 'bidding') return game.biddingActor;
  if (game.phase === 'contract-setup') return game.contractActor;
  if (game.phase !== 'trick-play') return null;
  const lastPlayed = game.currentTrick.at(-1);
  if (lastPlayed) return ((lastPlayed.seat + 1) % 4) as Seat;
  const lastWinner = game.publicEvents.findLast(
    (event) => event.type === 'trick-won',
  );
  return lastWinner?.seat ?? game.firstPlayer;
}

function TableScene({
  view,
  seconds,
  busy,
  start,
}: {
  readonly view: TableView;
  readonly seconds: number | null;
  readonly busy: boolean;
  readonly start: () => void;
}) {
  const game = view.game;
  const viewer = view.seat ?? 0;
  const active = game ? currentActor(game) : null;
  const trick = view.recentTrick.length
    ? view.recentTrick
    : (game?.currentTrick ?? []);
  const status =
    view.table.status === 'lobby'
      ? 'Venter på at bordet starter'
      : view.table.status === 'finished'
        ? 'Bordet er afsluttet'
        : view.seat === null
          ? 'Du er i kø til næste runde'
          : game?.phase === 'scoring'
            ? 'Runden er slut · ny runde starter snart'
            : game?.phase === 'bidding'
              ? 'Budrunde'
              : game?.phase === 'contract-setup'
                ? 'Kontrakten gøres klar'
                : `Stik ${(game?.completedTrickCount ?? 0) + 1} af 13`;

  return (
    <section className="table multi-felt" aria-label="Whistbord">
      {view.players.map((player) => {
        const position = relativeSeat(player.seat, viewer);
        const count =
          player.seat === view.seat
            ? game?.ownHand.length
            : game?.opponents.find((other) => other.seat === player.seat)
                ?.cardCount;
        return (
          <div
            key={player.seat}
            className={`${position === 0 ? 'human-seat' : `player-seat seat-${position}`} ${active === player.seat ? 'active-seat' : ''} ${player.isBot ? 'multi-bot-seat' : ''}`}
            aria-label={`${player.tag}, ${player.isBot ? 'bot' : player.connected ? 'online' : 'forbindelse afbrudt'}, ${view.scores[player.seat]} point`}
          >
            <div className="avatar" aria-hidden="true">
              {player.tag[0]}
            </div>
            <div>
              <strong>
                {player.seat === view.seat ? `${player.tag} · dig` : player.tag}
              </strong>
              <span>
                {player.isBot ? 'Bot · ' : player.connected ? '' : 'Offline · '}
                {view.scores[player.seat]} point
              </span>
              {game && (
                <span>
                  {count ?? 0} kort · {game.trickCounts[player.seat]} stik
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="table-center multi-table-center">
        {game?.phase === 'trick-play' || game?.phase === 'scoring' ? (
          <div
            className="current-trick"
            aria-label={
              view.recentTrick.length ? 'Sidste stik' : 'Aktuelt stik'
            }
          >
            {trick.map(({ seat, card }) => (
              <div
                key={`${seat}-${card.id}`}
                className={`trick-card trick-seat-${relativeSeat(seat, viewer)} multi-trick-card`}
              >
                <CardVisual card={card} />
              </div>
            ))}
          </div>
        ) : (
          <div className="kitty" aria-label="Byttekort">
            {[0, 1, 2].map((card) => (
              <div className="card-back" key={card} />
            ))}
          </div>
        )}
        <p aria-live="polite">{status}</p>
        {view.table.status === 'lobby' && view.isHost && (
          <button className="multi-primary" disabled={busy} onClick={start}>
            Start spillet
          </button>
        )}
        {view.table.status === 'lobby' && !view.isHost && (
          <span className="trick-result">Opretteren starter spillet</span>
        )}
        {seconds !== null && game?.phase !== 'scoring' && (
          <span className="trick-result">{seconds} sekunder tilbage</span>
        )}
        {game?.openHands.map((hand) => (
          <div
            className="open-hands"
            key={hand.seat}
            aria-label={`Åben hånd: ${view.players[hand.seat]?.tag ?? 'Spiller'}`}
          >
            <div className="open-hand">
              <span>{view.players[hand.seat]?.tag}</span>
              <div>
                {[...hand.cards].sort(compareHandCards).map((card) => (
                  <CardVisual key={card.id} card={card} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MultiplayerRoomPage() {
  const { tableId = '' } = useParams();
  const [token, setToken] = useState(() => savedToken(tableId));
  const [tag, setTag] = useState(
    () => window.localStorage.getItem('whistzilla-gamertag') ?? '',
  );
  const [view, setView] = useState<TableView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setView(await multiplayerApi.view(tableId, token));
      setError('');
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'seat-not-found') {
        window.localStorage.removeItem(`whistzilla-table:${tableId}`);
        setToken(null);
        setView(null);
      }
      setError(describeError(cause));
    }
  }, [tableId, token]);
  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      setError('');
    } catch (cause) {
      setError(describeError(cause));
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const join = async () => {
    setBusy(true);
    try {
      const result = await multiplayerApi.join(tableId, tag);
      window.localStorage.setItem('whistzilla-gamertag', tag.trim());
      saveToken(tableId, result.token);
      setToken(result.token);
      setError('');
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (index: number) => {
    if (!view?.game || !token) return;
    await run(() =>
      multiplayerApi.action(tableId, token, view.game!.revision, index),
    );
  };
  const send = async (message: string) => {
    if (!token) return;
    await run(() => multiplayerApi.chat(tableId, token, message));
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      setError('Linket kunne ikke kopieres. Kopiér adressen fra browseren.');
    }
  };
  const game = view?.game;
  const seconds =
    view?.turnDeadline && now > 0
      ? Math.max(0, Math.ceil((view.turnDeadline - now) / 1000))
      : null;
  const bids =
    game?.publicEvents
      .filter(
        (event) =>
          event.type === 'bid-placed' || event.type === 'player-passed',
      )
      .slice(-8) ?? [];

  return (
    <main className="multi-page multi-room">
      <header className="multi-header">
        <Link to="/multiplayer">← Borde</Link>
        <h1>{view?.table.name ?? 'Multiplayer'}</h1>
      </header>
      {!token && (
        <section className="multi-panel">
          <h2>Tilslut dig bordet</h2>
          <label className="multi-field">
            Dit gamertag
            <input
              value={tag}
              maxLength={20}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Skriv dit navn"
            />
          </label>
          <button
            className="multi-primary"
            disabled={busy || tag.trim().length < 2}
            onClick={() => void join()}
          >
            Deltag
          </button>
        </section>
      )}
      {view && (
        <>
          <div className="multi-toolbar">
            <span>
              {view.table.status === 'lobby'
                ? 'Lobby'
                : view.table.status === 'finished'
                  ? 'Afsluttet'
                  : `Runde ${view.table.round}`}
            </span>
            <button onClick={() => void copyLink()}>
              Kopiér invitationslink
            </button>
            {view.isHost && view.table.status !== 'finished' && (
              <button
                onClick={() => {
                  if (window.confirm('Afslut bordet og gem slutstillingen?'))
                    void run(() => multiplayerApi.end(tableId, token!));
                }}
              >
                Afslut bord
              </button>
            )}
          </div>
          {game && (
            <div
              className="contract-strip"
              role="region"
              aria-label={
                game.phase === 'bidding' ? 'Aktuel melding' : 'Kontrakt'
              }
            >
              <span className="contract-strip-label">
                {game.phase === 'bidding' ? 'Aktuel melding' : 'Kontrakt'}
              </span>
              <strong>
                {game.phase === 'bidding'
                  ? game.currentBid
                    ? bidLabel(game.currentBid)
                    : 'Ingen melding endnu'
                  : game.winningBid
                    ? bidLabel(game.winningBid)
                    : 'Afventer kontrakt'}
              </strong>
              {game.trump && <span>Trumf: {suitName[game.trump]}</span>}
              {game.phase === 'bidding' && (
                <span className="contract-strip-next">
                  Tur: {view.players[game.biddingActor]?.tag}
                </span>
              )}
            </div>
          )}
          <TableScene
            view={view}
            seconds={seconds}
            busy={busy}
            start={() => void run(() => multiplayerApi.start(tableId, token!))}
          />
          {game &&
            view.table.status === 'playing' &&
            game.phase !== 'scoring' && (
              <ActionControls
                key={`${view.table.round}-${game.phase}`}
                game={game}
                submit={submit}
                busy={busy}
              />
            )}
          {view.seat === null && view.table.status === 'playing' && (
            <p className="multi-waiting">
              Du får en botplads, når næste runde starter.
            </p>
          )}
          {game?.phase === 'scoring' && game.score && (
            <section
              className="multi-panel multi-round-result"
              aria-label="Rundens resultat"
            >
              <h2>
                {game.score.contractSucceeded
                  ? 'Kontrakten blev vundet'
                  : 'Kontrakten blev tabt'}
              </h2>
              <div className="round-score-grid">
                {game.score.deltas.map((delta, seat) => (
                  <span key={seat}>
                    <strong>{view.players[seat]?.tag}</strong>
                    <b>
                      {delta >= 0 ? '+' : ''}
                      {delta}
                    </b>
                  </span>
                ))}
              </div>
            </section>
          )}
          {bids.length > 0 && (
            <details className="multi-panel multi-bid-history">
              <summary>Bud i denne runde</summary>
              <p>
                {bids
                  .map(
                    (event) =>
                      `${view.players[event.seat]?.tag ?? 'Spiller'}: ${event.type === 'bid-placed' ? bidLabel(event.bid) : 'pas'}`,
                  )
                  .join(' · ')}
              </p>
            </details>
          )}
          <Chat view={view} send={send} />
          {view.table.status === 'finished' && (
            <button onClick={() => void navigate('/multiplayer')}>
              Find et nyt bord
            </button>
          )}
        </>
      )}
      {error && (
        <p className="multi-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
