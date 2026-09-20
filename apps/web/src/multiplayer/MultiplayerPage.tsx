import type { Bid, Card, GameCommand, PlayerView } from '@whistzilla/game-core';
import type { TableView } from '@whistzilla/multiplayer/tables';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CARD_RANK_LABELS, compareHandCards } from '../cards/presentation';
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
  const legal = game.legalCommands;
  if (!legal.length)
    return <p className="multi-waiting">Venter på den næste spiller…</p>;
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

  return (
    <section className="multi-actions" aria-label="Dine handlinger">
      <h3>Din tur</h3>
      {plays.length === 0 && exchanges.length === 0 && (
        <div className="multi-hand" aria-label="Din hånd">
          {[...game.ownHand].sort(compareHandCards).map((card) => (
            <span key={card.id}>{cardLabel(card)}</span>
          ))}
        </div>
      )}
      {bids.length > 0 && (
        <div className="multi-bids">
          {bids.map(({ command, index }) => (
            <button
              key={index}
              disabled={busy}
              onClick={() => void submit(index)}
            >
              {bidLabel(command.bid)}
            </button>
          ))}
        </div>
      )}
      {simple.length > 0 && (
        <div className="multi-simple-actions">
          {simple.map(({ command, index }) => (
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
      {plays.length > 0 && <p>Vælg et fremhævet kort fra din hånd.</p>}
      {exchanges.length > 0 && (
        <div className="multi-hand multi-select-hand">
          {[...game.ownHand].sort(compareHandCards).map((card) => (
            <button
              key={card.id}
              className={selected.includes(card.id) ? 'selected' : ''}
              aria-pressed={selected.includes(card.id)}
              onClick={() =>
                setSelected((current) =>
                  current.includes(card.id)
                    ? current.filter((id) => id !== card.id)
                    : [...current, card.id],
                )
              }
            >
              {cardLabel(card)}
            </button>
          ))}
        </div>
      )}
      {plays.length > 0 && (
        <div className="multi-hand">
          {[...game.ownHand].sort(compareHandCards).map((card) => {
            const play = plays.find(
              ({ command }) => command.cardId === card.id,
            );
            return (
              <button
                key={card.id}
                disabled={busy || !play}
                onClick={() => play && void submit(play.index)}
              >
                {cardLabel(card)}
              </button>
            );
          })}
        </div>
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
    <section className="multi-panel multi-chat" aria-label="Bordchat">
      <h2>Chat</h2>
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
  const sortedHand = useMemo(
    () => (game ? [...game.ownHand].sort(compareHandCards) : []),
    [game],
  );
  const activeTrick = view?.recentTrick.length
    ? view.recentTrick
    : (game?.currentTrick ?? []);
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
          <section
            className="multi-panel multi-scoreboard"
            aria-label="Spillere og point"
          >
            {view.players.map((player) => (
              <div key={player.seat}>
                <strong>{player.tag}</strong>
                <span>
                  {player.isBot
                    ? 'Bot'
                    : player.connected
                      ? 'Online'
                      : 'Forbindelse afbrudt'}{' '}
                  · {view.scores[player.seat]} point
                </span>
                {game && <small>{game.trickCounts[player.seat]} stik</small>}
              </div>
            ))}
          </section>
          {view.table.status === 'lobby' && (
            <section className="multi-panel">
              <h2>Klar til spil?</h2>
              <p>
                Ledige pladser spilles af bots. Opretteren bestemmer, hvornår
                bordet starter.
              </p>
              {view.isHost && (
                <button
                  className="multi-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(() => multiplayerApi.start(tableId, token!))
                  }
                >
                  Start spillet
                </button>
              )}
            </section>
          )}
          {view.seat === null && view.table.status === 'playing' && (
            <section className="multi-panel">
              <h2>Du er i kø</h2>
              <p>Du får en botplads, når næste runde starter.</p>
            </section>
          )}
          {game && (
            <>
              <section
                className="multi-panel multi-game-status"
                aria-live="polite"
              >
                <strong>
                  {game.phase === 'scoring'
                    ? 'Runden er slut'
                    : game.phase === 'bidding'
                      ? 'Budrunde'
                      : game.phase === 'contract-setup'
                        ? 'Kontrakten gøres klar'
                        : `Stik ${game.completedTrickCount + 1} af 13`}
                </strong>
                <span>
                  {game.currentBid && game.phase === 'bidding'
                    ? `Aktuelt bud: ${bidLabel(game.currentBid)}`
                    : game.winningBid
                      ? `Kontrakt: ${bidLabel(game.winningBid)}`
                      : 'Afventer første bud'}
                </span>
                {game.trump && <span>Trumf: {suitName[game.trump]}</span>}
                {seconds !== null && game.phase !== 'scoring' && (
                  <span>{seconds} sekunder tilbage på turen</span>
                )}
                {game.phase === 'scoring' && (
                  <span>Ny runde starter automatisk om lidt.</span>
                )}
              </section>
              {bids.length > 0 && (
                <section className="multi-panel multi-bid-history">
                  <h2>Bud</h2>
                  <p>
                    {bids
                      .map(
                        (event) =>
                          `${view.players[event.seat]?.tag ?? 'Spiller'}: ${event.type === 'bid-placed' ? bidLabel(event.bid) : 'pas'}`,
                      )
                      .join(' · ')}
                  </p>
                </section>
              )}
              {game.phase === 'trick-play' && (
                <section className="multi-panel multi-trick">
                  <h2>
                    {view.recentTrick.length ? 'Sidste stik' : 'Aktuelt stik'}
                  </h2>
                  <div>
                    {activeTrick.map(({ seat, card }) => (
                      <span key={`${seat}-${card.id}`}>
                        {view.players[seat]?.tag ?? 'Spiller'}:{' '}
                        <b>{cardLabel(card)}</b>
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {game.phase === 'scoring' && game.score && (
                <section className="multi-panel">
                  <h2>Rundens resultat</h2>
                  <p>
                    {game.score.contractSucceeded
                      ? 'Kontrakten blev vundet.'
                      : 'Kontrakten blev tabt.'}
                  </p>
                  <p>
                    {game.score.deltas
                      .map(
                        (delta, seat) =>
                          `${view.players[seat]?.tag ?? 'Spiller'}: ${delta >= 0 ? '+' : ''}${delta}`,
                      )
                      .join(' · ')}
                  </p>
                </section>
              )}
              {game.legalCommands.length > 0 ? (
                <ActionControls
                  key={game.revision}
                  game={game}
                  submit={submit}
                  busy={busy}
                />
              ) : (
                sortedHand.length > 0 && (
                  <section className="multi-panel">
                    <h2>Din hånd</h2>
                    <div className="multi-hand">
                      {sortedHand.map((card) => (
                        <span key={card.id}>{cardLabel(card)}</span>
                      ))}
                    </div>
                  </section>
                )
              )}
            </>
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
