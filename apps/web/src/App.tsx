import {
  applyCommand,
  createGame,
  projectPlayerView,
  replayGame,
  type Bid,
  type Card,
  type GameCommand,
  type GameState,
  type PlaceBidCommand,
  type ReplayRecord,
  type Seat,
} from '@whistzilla/game-core';
import {
  compareDecision,
  createCoachingReport,
  type CoachingReport,
} from '@whistzilla/coaching';
import {
  chooseStrategyAction,
  type StrategyProfile,
} from '@whistzilla/strategy';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ChevronLeft,
  ChevronRight,
  History,
  Lightbulb,
  MessageSquareText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CARD_RANK_LABELS, compareHandCards } from './cards/presentation';
import {
  archiveCompletedGame,
  clearActiveGame,
  listCompletedGames,
  loadActiveGame,
  saveActiveGame,
  type ArchivedReplay,
} from './persistence/gameStorage';

const HUMAN_SEAT: Seat = 0;
const BOT_BID_DELAY_MS = 750;
const BOT_PLAY_DELAY_MS = 320;
const DEAL_CARD_DELAY_MS = 110;
const PLAYER_NAMES = ['Dig', 'Signe', 'Malthe', 'Freja'] as const;
const SUITS = {
  clubs: { symbol: '♣', label: 'Klør' },
  diamonds: { symbol: '♦', label: 'Ruder' },
  hearts: { symbol: '♥', label: 'Hjerter' },
  spades: { symbol: '♠', label: 'Spar' },
} as const;
const BID_TYPES = {
  ordinary: 'almindelige',
  halves: 'halve',
  good: 'gode',
  vip: 'vip',
  sol: 'Sol',
  'pure-sol': 'Ren sol',
  'open-laydown': 'Bordlægger',
  'super-laydown': 'Super bordlægger',
} as const;

interface GameSession {
  readonly state: GameState;
  readonly record: ReplayRecord;
}

type BotDifficulty = Extract<
  StrategyProfile,
  'beginner' | 'intermediate' | 'advanced'
>;

interface CachedHumanDecision {
  readonly report: CoachingReport;
  readonly played: GameCommand;
}

const newSession = (): GameSession => {
  const config = {
    seed: Date.now() >>> 0,
    dealer: 3,
    host: HUMAN_SEAT,
  } as const;
  return {
    state: createGame(config),
    record: { schemaVersion: 1, config, commands: [] },
  };
};

const bidKey = (bid: Bid) =>
  bid.kind === 'numerical' ? `${bid.level}-${bid.bidType}` : bid.bidType;
const bidLabel = (bid: Bid) =>
  bid.kind === 'numerical'
    ? `${bid.level} ${BID_TYPES[bid.bidType]}`
    : BID_TYPES[bid.bidType];

function CardVisual({ card }: { readonly card: Card }) {
  if (card.kind === 'joker') {
    return (
      <div
        className="playing-card joker-card"
        aria-label={`Joker ${card.number}`}
      >
        <span>J</span>
        <strong>Joker</strong>
        <span>{card.number}</span>
      </div>
    );
  }
  const suit = SUITS[card.suit];
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div
      className={`playing-card ${red ? 'red-suit' : ''}`}
      aria-label={`${CARD_RANK_LABELS[card.rank]} ${suit.symbol}`}
    >
      <span className="card-corner">{CARD_RANK_LABELS[card.rank]}</span>
      <strong className="card-suit">{suit.symbol}</strong>
      <span className="card-corner card-corner-bottom">
        {CARD_RANK_LABELS[card.rank]}
      </span>
    </div>
  );
}

function PlayerSeat({
  seat,
  active,
  count,
  tricks,
}: {
  readonly seat: Seat;
  readonly active: boolean;
  readonly count: number;
  readonly tricks: number;
}) {
  return (
    <div className={`player-seat seat-${seat} ${active ? 'active-seat' : ''}`}>
      <div className="avatar" aria-hidden="true">
        {PLAYER_NAMES[seat][0]}
      </div>
      <div>
        <strong>{PLAYER_NAMES[seat]}</strong>
        <span>
          {count} kort · {tricks} stik
        </span>
      </div>
    </div>
  );
}

function BidControls({
  state,
  dispatch,
}: {
  readonly state: GameState;
  readonly dispatch: (command: GameCommand) => void;
}) {
  const commands = projectPlayerView(state, HUMAN_SEAT).legalCommands.filter(
    (command): command is PlaceBidCommand =>
      command.type === 'place-bid' &&
      command.bid.kind === 'numerical' &&
      (command.bid.bidType === 'ordinary' || command.bid.bidType === 'good'),
  );
  const [selectedKey, setSelectedKey] = useState('7-ordinary');
  const selected =
    commands.find(({ bid }) => bidKey(bid) === selectedKey) ?? commands[0];

  if (state.bidding.actor !== HUMAN_SEAT) {
    return (
      <div className="waiting-label">
        {PLAYER_NAMES[state.bidding.actor]} melder…
      </div>
    );
  }
  return (
    <div className="bid-controls">
      <label>
        <span>Din melding</span>
        <select
          aria-label="Din melding"
          value={selected ? bidKey(selected.bid) : ''}
          onChange={(event) => setSelectedKey(event.target.value)}
        >
          {commands.map(({ bid }) => (
            <option key={bidKey(bid)} value={bidKey(bid)}>
              {bidLabel(bid)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="primary-button"
        disabled={!selected}
        onClick={() => selected && dispatch(selected)}
      >
        Meld
      </button>
    </div>
  );
}

function ContractControls({
  state,
  dispatch,
}: {
  readonly state: GameState;
  readonly dispatch: (command: GameCommand) => void;
}) {
  const view = projectPlayerView(state, HUMAN_SEAT);
  if (state.declarer !== HUMAN_SEAT)
    return <div className="waiting-label">Kontrakten klargøres…</div>;

  if (!view.trump) {
    const commands = view.legalCommands.filter(
      (command): command is Extract<GameCommand, { type: 'choose-trump' }> =>
        command.type === 'choose-trump',
    );
    return (
      <div className="choice-controls">
        <span>Vælg trumf</span>
        <div>
          {commands.map((command) => (
            <button
              type="button"
              key={command.trump}
              onClick={() => dispatch(command)}
            >
              <b
                className={
                  command.trump === 'hearts' || command.trump === 'diamonds'
                    ? 'red-text'
                    : ''
                }
              >
                {SUITS[command.trump].symbol}
              </b>
              {SUITS[command.trump].label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!view.calledPartnerCardId) {
    const commands = view.legalCommands.filter(
      (command): command is Extract<GameCommand, { type: 'call-partner' }> =>
        command.type === 'call-partner',
    );
    return (
      <div className="choice-controls">
        <span>Vælg makkerkort</span>
        <div>
          {commands.map((command) => {
            const suit = command.cardId.split(':')[0] as keyof typeof SUITS;
            return (
              <button
                type="button"
                key={command.cardId}
                onClick={() => dispatch(command)}
              >
                <b
                  className={
                    suit === 'hearts' || suit === 'diamonds' ? 'red-text' : ''
                  }
                >
                  {SUITS[suit].symbol}
                </b>
                {command.cardId.endsWith(':ace') ? 'Es' : 'Konge'}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const skip = view.legalCommands.find(
    (command) => command.type === 'skip-exchange',
  );
  return (
    <div className="bid-controls">
      <button
        type="button"
        className="primary-button"
        disabled={!skip}
        onClick={() => skip && dispatch(skip)}
      >
        Fortsæt uden bytning
      </button>
    </div>
  );
}

function commandLabel(command: GameCommand): string {
  if (command.type === 'place-bid')
    return `${PLAYER_NAMES[command.actor]} meldte ${bidLabel(command.bid)}`;
  if (command.type === 'pass')
    return `${PLAYER_NAMES[command.actor]} meldte pas`;
  if (command.type === 'choose-trump')
    return `${PLAYER_NAMES[command.actor]} valgte ${SUITS[command.trump].label}`;
  if (command.type === 'call-partner')
    return `${PLAYER_NAMES[command.actor]} kaldte ${command.cardId}`;
  if (command.type === 'skip-exchange')
    return `${PLAYER_NAMES[command.actor]} fortsatte uden bytning`;
  return `${PLAYER_NAMES[command.actor]} spillede ${command.cardId}`;
}

function ReplayReview({ replay }: { readonly replay: ArchivedReplay }) {
  const [step, setStep] = useState(replay.record.commands.length);
  const reviewRecord = useMemo(
    () => ({
      ...replay.record,
      commands: replay.record.commands.slice(0, step),
    }),
    [replay.record, step],
  );
  const reviewState = replayGame(reviewRecord);
  const reviewView = projectPlayerView(reviewState, HUMAN_SEAT);
  const latest = step > 0 ? replay.record.commands[step - 1] : null;

  return (
    <div className="replay-review">
      <div className="review-meta">
        <strong>
          Trin {step} af {replay.record.commands.length}
        </strong>
        <span>
          {latest ? commandLabel(latest) : 'Spillet er klar til første melding'}
        </span>
      </div>
      <div className="review-hand" aria-label="Din hånd i replay">
        {reviewView.ownHand.map((card) => (
          <CardVisual card={card} key={card.id} />
        ))}
      </div>
      <div className="review-controls">
        <button
          type="button"
          className="icon-button"
          aria-label="Forrige trin"
          disabled={step === 0}
          onClick={() => setStep((value) => value - 1)}
        >
          <ChevronLeft size={19} />
        </button>
        <input
          aria-label="Replay-position"
          type="range"
          min="0"
          max={replay.record.commands.length}
          value={step}
          onChange={(event) => setStep(Number(event.target.value))}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Næste trin"
          disabled={step === replay.record.commands.length}
          onClick={() => setStep((value) => value + 1)}
        >
          <ChevronRight size={19} />
        </button>
      </div>
    </div>
  );
}

function ReplayLibrary() {
  const [open, setOpen] = useState(false);
  const [replays, setReplays] = useState<readonly ArchivedReplay[]>([]);
  const [selected, setSelected] = useState<ArchivedReplay | null>(null);

  useEffect(() => {
    if (!open) return;
    void listCompletedGames()
      .then(setReplays)
      .catch(() => setReplays([]));
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSelected(null);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="icon-button"
          aria-label="Spilhistorik"
          title="Spilhistorik"
        >
          <History size={19} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-header">
            <div>
              <Dialog.Title>Spilhistorik</Dialog.Title>
              <Dialog.Description>
                Gennemgå dine afsluttede spil.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label="Luk historik"
              >
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>
          {selected ? (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => setSelected(null)}
              >
                Tilbage til spil
              </button>
              <ReplayReview replay={selected} />
            </>
          ) : replays.length > 0 ? (
            <div className="replay-list">
              {replays.map((replay) => {
                const finalState = replayGame(replay.record);
                return (
                  <button
                    type="button"
                    className="replay-row"
                    key={replay.id}
                    onClick={() => setSelected(replay)}
                  >
                    <span>
                      <strong>
                        {finalState.winningBid
                          ? bidLabel(finalState.winningBid)
                          : 'Afsluttet spil'}
                      </strong>
                      <small>
                        {new Date(replay.completedAt).toLocaleString('da-DK')}
                      </small>
                    </span>
                    <span>
                      {finalState.trickPlay.trickCounts[HUMAN_SEAT]} stik
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">Ingen afsluttede spil endnu.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsDialog({
  difficulty,
  setDifficulty,
}: {
  readonly difficulty: BotDifficulty;
  readonly setDifficulty: (difficulty: BotDifficulty) => void;
}) {
  const options: readonly {
    readonly value: BotDifficulty;
    readonly label: string;
    readonly detail: string;
  }[] = [
    {
      value: 'beginner',
      label: 'Begynder',
      detail: 'Enkle lovlige valg og lavkortsspil',
    },
    {
      value: 'intermediate',
      label: 'Øvet',
      detail: 'Taktiske vindere og farvestyrke',
    },
    {
      value: 'advanced',
      label: 'Avanceret',
      detail: 'Synlig kort-hukommelse og renoncer',
    },
  ];
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="icon-button"
          aria-label="Indstillinger"
          title="Indstillinger"
        >
          <SlidersHorizontal size={19} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content settings-dialog">
          <div className="dialog-header">
            <div>
              <Dialog.Title>Indstillinger</Dialog.Title>
              <Dialog.Description>Tilpas spillet.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button"
                aria-label="Luk indstillinger"
              >
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>
          <fieldset className="difficulty-options">
            <legend>Botniveau</legend>
            {options.map((option) => (
              <label
                key={option.value}
                className={difficulty === option.value ? 'selected-option' : ''}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={option.value}
                  checked={difficulty === option.value}
                  onChange={() => setDifficulty(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CoachPanel({
  view,
  level,
  setLevel,
}: {
  readonly view: ReturnType<typeof projectPlayerView>;
  readonly level: 'hint' | 'training' | null;
  readonly setLevel: (level: 'hint' | 'training' | null) => void;
}) {
  if (view.legalCommands.length === 0) return null;
  const report = createCoachingReport(view, level ?? 'hint');
  const bestScore = report.recommended?.score ?? 0;

  return (
    <div className="coach-shell">
      {level === null ? (
        <button
          type="button"
          className="coach-launcher"
          aria-label="Få et hint"
          title="Få et hint"
          onClick={() => setLevel('hint')}
        >
          <Lightbulb size={20} />
        </button>
      ) : (
        <aside className="coach-panel" aria-label="Coach">
          <div className="coach-header">
            <span>
              <Lightbulb size={17} /> Coach
            </span>
            <button
              type="button"
              className="plain-icon"
              aria-label="Luk coach"
              onClick={() => setLevel(null)}
            >
              <X size={17} />
            </button>
          </div>
          <strong>{report.prompt}</strong>
          {report.facts.slice(0, 3).map((fact) => (
            <p key={fact.text}>{fact.text}</p>
          ))}
          {level === 'hint' ? (
            <button
              type="button"
              className="coach-action"
              onClick={() => setLevel('training')}
            >
              <Sparkles size={16} /> Vis anbefaling
            </button>
          ) : report.recommended ? (
            <div className="candidate-list">
              {[report.recommended, ...report.alternatives].map(
                (candidate, index) => (
                  <div
                    className="candidate-row"
                    key={JSON.stringify(candidate.command)}
                  >
                    <span>
                      <b>{index === 0 ? 'Anbefalet' : 'Alternativ'}</b>
                      {commandLabel(candidate.command)}
                    </span>
                    <small>
                      {index === 0
                        ? 'Stærkest'
                        : `${Math.max(0, bestScore - candidate.score)} efter`}
                    </small>
                  </div>
                ),
              )}
            </div>
          ) : null}
        </aside>
      )}
    </div>
  );
}

function DecisionReview({
  decision,
  open,
  setOpen,
}: {
  readonly decision: CachedHumanDecision | null;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}) {
  if (!decision) return null;
  const comparison = compareDecision(decision.report, decision.played);
  const preferred = decision.report.recommended;
  return (
    <div className="decision-review-shell">
      {!open ? (
        <button
          type="button"
          className="decision-review-launcher"
          aria-label="Se seneste valg"
          title="Se seneste valg"
          onClick={() => setOpen(true)}
        >
          <MessageSquareText size={19} />
        </button>
      ) : (
        <aside className="decision-review" aria-label="Dit seneste valg">
          <div className="coach-header">
            <span>
              <MessageSquareText size={17} /> Dit seneste valg
            </span>
            <button
              type="button"
              className="plain-icon"
              aria-label="Luk seneste valg"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <p>
            Du valgte <strong>{commandLabel(decision.played)}</strong>.
          </p>
          {comparison.matchedRecommendation ? (
            <p>Motoren var enig i dit valg.</p>
          ) : preferred ? (
            <p>
              Motoren foretrak{' '}
              <strong>{commandLabel(preferred.command)}</strong>, fordi den{' '}
              {preferred.reasons[0]?.text ?? 'vurderede handlingen stærkere'}.
            </p>
          ) : null}
        </aside>
      )}
    </div>
  );
}

export function App() {
  const [session, setSession] = useState(newSession);
  const [storageReady, setStorageReady] = useState(false);
  const [coachLevel, setCoachLevel] = useState<'hint' | 'training' | null>(
    null,
  );
  const [botDifficulty, setBotDifficultyState] = useState<BotDifficulty>(() => {
    const stored = window.localStorage.getItem('whistzilla-bot-difficulty');
    return stored === 'beginner' || stored === 'advanced'
      ? stored
      : 'intermediate';
  });
  const [visibleDealCount, setVisibleDealCount] = useState(0);
  const [lastHumanDecision, setLastHumanDecision] =
    useState<CachedHumanDecision | null>(null);
  const [decisionReviewOpen, setDecisionReviewOpen] = useState(false);
  const state = session.state;
  const isDealing = visibleDealCount < 13;
  const view = projectPlayerView(state, HUMAN_SEAT);
  const sortedHand = useMemo(
    () => [...view.ownHand].sort(compareHandCards),
    [view.ownHand],
  );
  const dispatch = useCallback((command: GameCommand) => {
    setSession((current) => {
      const result = applyCommand(current.state, command);
      return result.ok
        ? {
            state: result.state,
            record: {
              ...current.record,
              commands: [...current.record.commands, command],
            },
          }
        : current;
    });
  }, []);
  const dispatchHuman = useCallback(
    (command: GameCommand) => {
      setLastHumanDecision({
        report: createCoachingReport(view, 'training'),
        played: command,
      });
      setDecisionReviewOpen(false);
      setCoachLevel(null);
      dispatch(command);
    },
    [dispatch, view],
  );
  const setBotDifficulty = useCallback((difficulty: BotDifficulty) => {
    window.localStorage.setItem('whistzilla-bot-difficulty', difficulty);
    setBotDifficultyState(difficulty);
  }, []);

  const startNewGame = useCallback(() => {
    void clearActiveGame().catch(() => undefined);
    setSession(newSession());
    setCoachLevel(null);
    setVisibleDealCount(0);
    setLastHumanDecision(null);
    setDecisionReviewOpen(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadActiveGame()
      .then((record) => {
        if (active && record) {
          setSession({ state: replayGame(record), record });
          setVisibleDealCount(13);
        }
      })
      .catch(() => clearActiveGame().catch(() => undefined))
      .finally(() => {
        if (active) setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady || !isDealing) return;
    const timer = window.setTimeout(() => {
      setVisibleDealCount((count) => Math.min(13, count + 1));
    }, DEAL_CARD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isDealing, storageReady, visibleDealCount]);

  useEffect(() => {
    if (!storageReady) return;
    if (state.phase === 'scoring') {
      void archiveCompletedGame(session.record)
        .then(clearActiveGame)
        .catch(() => undefined);
    } else {
      void saveActiveGame(session.record).catch(() => undefined);
    }
  }, [session, state.phase, storageReady]);

  useEffect(() => {
    const actor =
      state.phase === 'bidding'
        ? state.bidding.actor
        : state.phase === 'trick-play'
          ? state.trickPlay.actor
          : state.phase === 'contract-setup'
            ? state.declarer
            : null;
    if (!storageReady || isDealing || actor === null || actor === HUMAN_SEAT)
      return;
    const timer = window.setTimeout(
      () => {
        const decision = chooseStrategyAction(
          projectPlayerView(state, actor),
          botDifficulty,
        );
        if (decision) dispatch(decision.command);
      },
      state.phase === 'bidding' ? BOT_BID_DELAY_MS : BOT_PLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [botDifficulty, dispatch, isDealing, state, storageReady]);

  const activeSeat =
    state.phase === 'bidding' ? state.bidding.actor : state.trickPlay.actor;
  const scoreStatus =
    view.score?.status === 'scored'
      ? `${view.score.deltas[HUMAN_SEAT] >= 0 ? '+' : ''}${view.score.deltas[HUMAN_SEAT]} point`
      : view.score?.status === 'pending-self-partner-rule'
        ? 'Selvmakker · point afventer regel'
        : `${state.trickPlay.trickCounts[0]} stik`;
  const latestPublicEvent = state.publicEvents.at(-1);
  const biddingStatus =
    latestPublicEvent?.type === 'player-passed'
      ? `${PLAYER_NAMES[latestPublicEvent.seat]} meldte pas · ${PLAYER_NAMES[state.bidding.actor]} tænker`
      : latestPublicEvent?.type === 'bid-placed'
        ? `${PLAYER_NAMES[latestPublicEvent.seat]} meldte ${bidLabel(latestPublicEvent.bid)}`
        : state.bidding.currentBid
          ? `${bidLabel(state.bidding.currentBid)} · ${PLAYER_NAMES[state.bidding.bidHolder ?? state.bidding.actor]}`
          : 'Første melding';
  const status =
    state.phase === 'scoring'
      ? `Spillet er slut · ${scoreStatus}`
      : state.phase === 'trick-play'
        ? `Stik ${state.trickPlay.completedTricks.length + 1} · ${PLAYER_NAMES[state.trickPlay.actor]} spiller`
        : state.phase === 'contract-setup' && state.winningBid
          ? `${bidLabel(state.winningBid)} · vælg kontrakten`
          : biddingStatus;
  const recommendedCommand =
    coachLevel === 'training'
      ? createCoachingReport(view, 'training').recommended?.command
      : null;
  const recommendedCardId =
    recommendedCommand?.type === 'play-card' ? recommendedCommand.cardId : null;

  return (
    <main className="game-page">
      <header className="topbar">
        <h1>Whistzilla</h1>
        <div className="topbar-actions">
          <ReplayLibrary />
          <SettingsDialog
            difficulty={botDifficulty}
            setDifficulty={setBotDifficulty}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Nyt spil"
            title="Nyt spil"
            onClick={startNewGame}
          >
            <RotateCcw size={19} />
          </button>
        </div>
      </header>
      <section className="table" aria-label="Whistbord">
        {view.opponents.map((opponent) => (
          <PlayerSeat
            key={opponent.seat}
            seat={opponent.seat}
            active={activeSeat === opponent.seat && state.phase !== 'scoring'}
            count={opponent.cardCount}
            tricks={view.trickCounts[opponent.seat]}
          />
        ))}
        <div className="table-center">
          {state.phase === 'trick-play' || state.phase === 'scoring' ? (
            <div className="current-trick" aria-label="Aktuelt stik">
              {view.currentTrick.map(({ seat, card }) => (
                <div
                  className={`trick-card trick-seat-${seat}`}
                  key={`${seat}-${card.id}`}
                >
                  <CardVisual card={card} />
                </div>
              ))}
            </div>
          ) : (
            <div className="kitty" aria-label="Tre byttere">
              {[0, 1, 2].map((card) => (
                <div className="card-back" key={card} />
              ))}
            </div>
          )}
          <p>{status}</p>
        </div>
        <div
          className={`human-seat ${activeSeat === HUMAN_SEAT && state.phase !== 'scoring' ? 'human-active' : ''}`}
        >
          <span>Din hånd</span>
          <strong>
            {view.ownHand.length} kort · {view.trickCounts[0]} stik
          </strong>
        </div>
      </section>

      <section
        className={`hand-area ${state.phase === 'scoring' ? 'scoring-area' : ''}`}
        aria-label="Din hånd"
      >
        <div className="hand">
          {sortedHand.slice(0, visibleDealCount).map((card) => {
            const command = view.legalCommands.find(
              (
                candidate,
              ): candidate is Extract<GameCommand, { type: 'play-card' }> =>
                candidate.type === 'play-card' && candidate.cardId === card.id,
            );
            return (
              <button
                type="button"
                className={`hand-card ${recommendedCardId === card.id ? 'recommended-card' : ''}`}
                aria-label={`Spil ${card.id}`}
                disabled={!command}
                key={card.id}
                onClick={() => command && dispatchHuman(command)}
              >
                <CardVisual card={card} />
              </button>
            );
          })}
        </div>
        {isDealing ? (
          <div className="waiting-label">Kortene deles…</div>
        ) : state.phase === 'bidding' ? (
          <BidControls state={state} dispatch={dispatchHuman} />
        ) : state.phase === 'contract-setup' ? (
          <ContractControls state={state} dispatch={dispatchHuman} />
        ) : state.phase === 'scoring' ? (
          <div className="bid-controls">
            <button
              type="button"
              className="primary-button"
              onClick={startNewGame}
            >
              Nyt spil
            </button>
          </div>
        ) : (
          <div className="waiting-label">
            {state.trickPlay.actor === HUMAN_SEAT
              ? 'Vælg et kort'
              : `${PLAYER_NAMES[state.trickPlay.actor]} spiller…`}
          </div>
        )}
      </section>
      <CoachPanel view={view} level={coachLevel} setLevel={setCoachLevel} />
      <DecisionReview
        decision={lastHumanDecision}
        open={decisionReviewOpen}
        setOpen={setDecisionReviewOpen}
      />
    </main>
  );
}
