import {
  applyCommand,
  createGame,
  projectPlayerView,
  replayGame,
  scoreNumericalContract,
  scoreSpecialContract,
  type Bid,
  type Card,
  type GameCommand,
  type GameState,
  type PlaceBidCommand,
  type ReplayRecord,
  type Seat,
  type NumericalLevel,
  type SpecialBidType,
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
  Calculator,
  History,
  House,
  Lightbulb,
  MessageSquareText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

import { CARD_RANK_LABELS, compareHandCards } from './cards/presentation';
import {
  MultiplayerLobbyPage,
  MultiplayerRoomPage,
} from './multiplayer/MultiplayerPage';
import {
  archiveCompletedGame,
  clearActiveGame,
  EMPTY_MATCH_PROGRESS,
  listCompletedGames,
  loadActiveGame,
  loadMatchProgress,
  saveActiveGame,
  saveMatchProgress,
  type ArchivedReplay,
  type MatchProgress,
} from './persistence/gameStorage';

const HUMAN_SEAT: Seat = 0;
const BOT_BID_DELAY_MS = 750;
const BOT_PLAY_DELAY_MS = 320;
const COMPLETED_TRICK_DELAY_MS = 950;
const DEAL_CARD_DELAY_MS = 110;
const PLAYER_NAMES = ['Dig', 'Ronaldo', 'Layla', 'Messi'] as const;
const MULTIPLAYER_ENABLED =
  import.meta.env.DEV || Boolean(import.meta.env.VITE_MULTIPLAYER_API_URL);
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
type AssistanceMode = 'none' | 'hint' | 'guided' | 'training';

interface CachedHumanDecision {
  readonly report: CoachingReport;
  readonly played: GameCommand;
}

const newSession = (dealer: Seat = 3): GameSession => {
  const randomSeed = new Uint32Array(1);
  window.crypto.getRandomValues(randomSeed);
  const config = {
    seed: randomSeed[0] ?? Date.now() >>> 0,
    dealer,
    host: HUMAN_SEAT,
  } as const;
  return {
    state: createGame(config),
    record: { schemaVersion: 1, config, commands: [] },
  };
};

const bidLabel = (bid: Bid) =>
  bid.kind === 'numerical'
    ? `${bid.level} ${BID_TYPES[bid.bidType]}`
    : BID_TYPES[bid.bidType];

const cardLabel = (card: Card) =>
  card.kind === 'joker'
    ? `Joker ${card.number}`
    : `${CARD_RANK_LABELS[card.rank]} ${SUITS[card.suit].label}`;

function includeCompletedRound(
  progress: MatchProgress,
  state: GameState,
): MatchProgress {
  if (
    state.phase !== 'scoring' ||
    state.score?.status !== 'scored' ||
    progress.lastScoredSeed === state.seed
  )
    return progress;
  const deltas = state.score.deltas;
  return {
    scores: progress.scores.map((score, seat) => score + deltas[seat]!) as [
      number,
      number,
      number,
      number,
    ],
    rounds: progress.rounds + 1,
    nextDealer: ((state.dealer + 1) % 4) as Seat,
    lastScoredSeed: state.seed,
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function playActionSound(command: GameCommand) {
  if (!window.AudioContext) return;
  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value =
    command.type === 'place-bid'
      ? 520
      : command.type === 'pass'
        ? 280
        : command.type === 'play-card'
          ? 410
          : 350;
  gain.gain.setValueAtTime(0.035, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.addEventListener('ended', () => void context.close());
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}

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
  const legalCommands = projectPlayerView(state, HUMAN_SEAT).legalCommands;
  const commands = legalCommands.filter(
    (command): command is PlaceBidCommand => command.type === 'place-bid',
  );
  const pass = legalCommands.find((command) => command.type === 'pass');
  const [selectedType, setSelectedType] = useState<Bid['bidType']>('ordinary');
  const [selectedLevel, setSelectedLevel] = useState(7);
  const availableTypes = Object.keys(BID_TYPES).filter((bidType) =>
    commands.some(({ bid }) => bid.bidType === bidType),
  ) as Bid['bidType'][];
  const selectedTypeAvailable = availableTypes.includes(selectedType)
    ? selectedType
    : availableTypes[0];
  const numericalLevels = commands.flatMap(({ bid }) =>
    bid.kind === 'numerical' && bid.bidType === selectedTypeAvailable
      ? [bid.level]
      : [],
  );
  const effectiveLevel = numericalLevels.includes(
    selectedLevel as (typeof numericalLevels)[number],
  )
    ? selectedLevel
    : numericalLevels[0];
  const selected = commands.find(({ bid }) =>
    bid.kind === 'numerical'
      ? bid.bidType === selectedTypeAvailable && bid.level === effectiveLevel
      : bid.bidType === selectedTypeAvailable,
  );

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
        <span>Type</span>
        <select
          aria-label="Meldingstype"
          value={selectedTypeAvailable ?? ''}
          onChange={(event) =>
            setSelectedType(event.target.value as Bid['bidType'])
          }
        >
          {availableTypes.map((bidType) => (
            <option key={bidType} value={bidType}>
              {BID_TYPES[bidType]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Niveau</span>
        <select
          aria-label="Meldingsniveau"
          value={effectiveLevel ?? ''}
          disabled={numericalLevels.length === 0}
          onChange={(event) => setSelectedLevel(Number(event.target.value))}
        >
          {numericalLevels.length === 0 ? (
            <option value="">—</option>
          ) : (
            numericalLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))
          )}
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
      {pass && (
        <button type="button" onClick={() => dispatch(pass)}>
          Pas
        </button>
      )}
    </div>
  );
}

function ContractControls({
  state,
  dispatch,
  selectedDiscardIds,
  setSelectedDiscardIds,
}: {
  readonly state: GameState;
  readonly dispatch: (command: GameCommand) => void;
  readonly selectedDiscardIds: readonly string[];
  readonly setSelectedDiscardIds: (ids: readonly string[]) => void;
}) {
  const view = projectPlayerView(state, HUMAN_SEAT);
  if (view.contractActor !== HUMAN_SEAT)
    return <div className="waiting-label">Kontrakten klargøres…</div>;

  const supportedContract = state.winningBid !== null;
  if (!supportedContract) {
    return (
      <div className="waiting-label unsupported-contract-message">
        {state.winningBid
          ? `${bidLabel(state.winningBid)} er meldt. Kontraktens setupregler afventer afklaring.`
          : 'Kontrakten afventer.'}
      </div>
    );
  }

  const needsPartnerBeforeTrump =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'halves' &&
    !view.calledPartnerCardId;
  const isVip =
    state.winningBid?.kind === 'numerical' &&
    state.winningBid.bidType === 'vip';
  const isSpecial = state.winningBid?.kind === 'special';

  if (isVip && !view.vipTrumpResolved) {
    const reveal = view.legalCommands.find(
      (command) => command.type === 'reveal-vip-card',
    );
    const stop = view.legalCommands.find(
      (command) => command.type === 'stop-vip',
    );
    return (
      <div className="exchange-controls">
        <span>Vend bytterne én ad gangen</span>
        <div className="exchange-kitty" aria-label="Vendte byttere">
          {view.vipRevealedCards.map((card) => (
            <CardVisual card={card} key={card.id} />
          ))}
        </div>
        <div className="exchange-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!reveal}
            onClick={() => reveal && dispatch(reveal)}
          >
            Vend næste bytter
          </button>
          {stop && (
            <button type="button" onClick={() => dispatch(stop)}>
              Stop med {view.trump ? SUITS[view.trump].label : 'trumfen'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!view.trump && !needsPartnerBeforeTrump && !isVip && !isSpecial) {
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

  if (!view.calledPartnerCardId && !isSpecial) {
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
  const exchange = view.legalCommands.find(
    (command) =>
      command.type === 'exchange-cards' &&
      sameCardIds(command.discardedCardIds, selectedDiscardIds),
  );
  const requiredVipCount = isVip ? view.vipRevealedCards.length : null;
  return (
    <div className="exchange-controls">
      <span>
        {selectedDiscardIds.length === 0
          ? requiredVipCount
            ? `Vip kræver, at du vælger ${requiredVipCount} kort fra hånden`
            : 'Vælg 1–3 kort fra hånden'
          : `${selectedDiscardIds.length} kort valgt. De nye kort vises efter bytningen.`}
      </span>
      <div className="exchange-actions">
        {selectedDiscardIds.length > 0 && (
          <button type="button" onClick={() => setSelectedDiscardIds([])}>
            Nulstil
          </button>
        )}
        <button
          type="button"
          className="primary-button"
          disabled={!exchange}
          onClick={() => exchange && dispatch(exchange)}
        >
          Byt {selectedDiscardIds.length || ''} kort
        </button>
        {skip && (
          <button type="button" onClick={() => dispatch(skip)}>
            Fortsæt uden bytning
          </button>
        )}
      </div>
    </div>
  );
}

function sameCardIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
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
  if (command.type === 'reveal-vip-card')
    return `${PLAYER_NAMES[command.actor]} vendte en bytter`;
  if (command.type === 'stop-vip')
    return `${PLAYER_NAMES[command.actor]} stoppede Vip`;
  if (command.type === 'exchange-cards')
    return `${PLAYER_NAMES[command.actor]} byttede ${command.discardedCardIds.length} kort`;
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
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listCompletedGames()
      .then(setReplays)
      .catch(() => {
        setReplays([]);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setLoading(true);
          setLoadFailed(false);
        }
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
          {loading ? (
            <p className="empty-state" role="status">
              Henter spilhistorik…
            </p>
          ) : loadFailed ? (
            <p className="empty-state" role="alert">
              Spilhistorikken kunne ikke indlæses.
            </p>
          ) : selected ? (
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
  assistance,
  setAssistance,
  resetScore,
  soundEnabled,
  setSoundEnabled,
}: {
  readonly difficulty: BotDifficulty;
  readonly setDifficulty: (difficulty: BotDifficulty) => void;
  readonly assistance: AssistanceMode;
  readonly setAssistance: (assistance: AssistanceMode) => void;
  readonly resetScore: () => void;
  readonly soundEnabled: boolean;
  readonly setSoundEnabled: (enabled: boolean) => void;
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
          <fieldset className="difficulty-options">
            <legend>Assistance</legend>
            {(
              [
                ['none', 'Ingen hjælp', 'Kun dit eget spil og efterreview'],
                ['hint', 'Hint', 'Hjælp vises kun, når du beder om den'],
                ['guided', 'Guidet', 'En stille markering ved beslutninger'],
                ['training', 'Træning', 'Vis anbefalinger ved hvert valg'],
              ] as const
            ).map(([value, label, detail]) => (
              <label
                key={value}
                className={assistance === value ? 'selected-option' : ''}
              >
                <input
                  type="radio"
                  name="assistance"
                  value={value}
                  checked={assistance === value}
                  onChange={() => setAssistance(value)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="sound-option">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(event.target.checked)}
            />
            <span>
              <strong>Spillyde</strong>
              <small>Korte signaler ved meldinger og kort</small>
            </span>
          </label>
          <button type="button" className="text-button" onClick={resetScore}>
            Nulstil samlet regnskab
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CoachPanel({
  view,
  level,
  setLevel,
  mode,
}: {
  readonly view: ReturnType<typeof projectPlayerView>;
  readonly level: 'hint' | 'training' | null;
  readonly setLevel: (level: 'hint' | 'training' | null) => void;
  readonly mode: AssistanceMode;
}) {
  if (view.legalCommands.length === 0 || mode === 'none') return null;
  const report = createCoachingReport(view, level ?? 'hint');
  const bestScore = report.recommended?.score ?? 0;

  return (
    <div className="coach-shell">
      {level === null ? (
        <button
          type="button"
          className="coach-launcher"
          aria-label={mode === 'guided' ? 'Overvej dit valg' : 'Få et hint'}
          title={mode === 'guided' ? 'Overvej dit valg' : 'Få et hint'}
          onClick={() => setLevel('hint')}
        >
          {mode === 'guided' ? <Sparkles size={20} /> : <Lightbulb size={20} />}
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

function HomePage() {
  return (
    <main className="home-page">
      <div className="home-hero">
        <span className="home-kicker">Dansk Whist · lær, spil og regn</span>
        <h1>Whistzilla</h1>
        <p>Træn dit spil, hold styr på pointene, og gør dig klar til bordet.</p>
      </div>
      <nav className="mode-grid" aria-label="Vælg funktion">
        <Link className="mode-card mode-card-primary" to="/training">
          <span className="mode-icon" aria-hidden="true">
            <Swords size={28} />
          </span>
          <span>
            <strong>Training</strong>
            <small>Spil mod tre bots med hints og beslutningsreview.</small>
          </span>
        </Link>
        {MULTIPLAYER_ENABLED ? (
          <Link className="mode-card" to="/multiplayer">
            <span className="mode-icon" aria-hidden="true">
              <Users size={28} />
            </span>
            <span>
              <strong>Multiplayer</strong>
              <small>
                Opret et bord, del et link, og spil med mennesker og bots.
              </small>
            </span>
          </Link>
        ) : (
          <div className="mode-card mode-card-disabled" aria-disabled="true">
            <span className="mode-icon" aria-hidden="true">
              <Users size={28} />
            </span>
            <span>
              <strong>Multiplayer</strong>
              <small>Åbner, når den gratis spilserver er forbundet.</small>
            </span>
          </div>
        )}
        <Link className="mode-card" to="/points">
          <span className="mode-icon" aria-hidden="true">
            <Calculator size={28} />
          </span>
          <span>
            <strong>Points calculator</strong>
            <small>
              Beregn en numerisk kontrakt efter Whistzilla-reglerne.
            </small>
          </span>
        </Link>
      </nav>
    </main>
  );
}

const CALCULATOR_BID_TYPES: readonly Bid['bidType'][] = [
  'ordinary',
  'halves',
  'good',
  'vip',
  'sol',
  'pure-sol',
  'open-laydown',
  'super-laydown',
];

const SPECIAL_CALCULATOR_BIDS: readonly SpecialBidType[] = [
  'sol',
  'pure-sol',
  'open-laydown',
  'super-laydown',
];

function isSpecialBidType(value: Bid['bidType']): value is SpecialBidType {
  return SPECIAL_CALCULATOR_BIDS.includes(value as SpecialBidType);
}

function PointsCalculatorPage() {
  const [bidType, setBidType] = useState<Bid['bidType']>('ordinary');
  const [level, setLevel] = useState<NumericalLevel>(7);
  const [teamTricks, setTeamTricks] = useState(7);
  const [vipRevealCount, setVipRevealCount] = useState(1);
  const [selfPartner, setSelfPartner] = useState(false);
  const special = isSpecialBidType(bidType);
  const score = special
    ? scoreSpecialContract({ kind: 'special', bidType }, 0, [
        teamTricks,
        13 - teamTricks,
        0,
        0,
      ])
    : scoreNumericalContract(
        { kind: 'numerical', bidType, level },
        0,
        selfPartner ? 0 : 2,
        [teamTricks, 13 - teamTricks, 0, 0],
        vipRevealCount,
      );

  return (
    <main className="utility-page">
      <header className="utility-header">
        <Link className="icon-button" to="/" aria-label="Til forsiden">
          <House size={19} />
        </Link>
        <div>
          <span>Whistzilla</span>
          <h1>Points calculator</h1>
        </div>
      </header>
      <section className="calculator-card" aria-label="Pointberegner">
        <div className="calculator-fields">
          <label>
            <span>Meldingstype</span>
            <select
              value={bidType}
              onChange={(event) =>
                setBidType(event.target.value as Bid['bidType'])
              }
            >
              {CALCULATOR_BID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BID_TYPES[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Niveau</span>
            <select
              value={level}
              disabled={special}
              onChange={(event) =>
                setLevel(Number(event.target.value) as NumericalLevel)
              }
            >
              {[7, 8, 9, 10, 11, 12, 13].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {bidType === 'vip' && (
            <label>
              <span>Vip</span>
              <select
                value={vipRevealCount}
                onChange={(event) =>
                  setVipRevealCount(Number(event.target.value))
                }
              >
                <option value="1">1. Vip</option>
                <option value="2">2. Vip</option>
                <option value="3">3. Vip</option>
              </select>
            </label>
          )}
          <label>
            <span>{special ? 'Melderens stik' : 'Melderholdets stik'}</span>
            <input
              type="number"
              min="0"
              max="13"
              value={teamTricks}
              onChange={(event) =>
                setTeamTricks(
                  Math.max(0, Math.min(13, Number(event.target.value))),
                )
              }
            />
          </label>
          {!special && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={selfPartner}
                onChange={(event) => setSelfPartner(event.target.checked)}
              />
              <span>Selvmakker (provisorisk pointregel)</span>
            </label>
          )}
        </div>
        {score.status === 'scored' && (
          <div className="score-result" aria-live="polite">
            <span>
              {score.contractSucceeded
                ? 'Kontrakten vundet'
                : 'Kontrakten tabt'}
            </span>
            <strong>{score.pointValue} point pr. stikværdi</strong>
            <div className="score-deltas">
              {score.deltas.map((delta, seat) => (
                <div key={seat}>
                  <span>
                    {selfPartner && !special
                      ? seat === 0
                        ? 'Melder'
                        : `Modspiller ${seat}`
                      : PLAYER_NAMES[seat]}
                  </span>
                  <b>{delta >= 0 ? `+${delta}` : delta}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export function GamePage() {
  const reducedMotion = usePrefersReducedMotion();
  const [session, setSession] = useState(newSession);
  const [storageReady, setStorageReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [matchProgress, setMatchProgress] =
    useState<MatchProgress>(EMPTY_MATCH_PROGRESS);
  const [assistanceMode, setAssistanceModeState] = useState<AssistanceMode>(
    () => {
      const stored = window.localStorage.getItem('whistzilla-assistance');
      return stored === 'none' || stored === 'guided' || stored === 'training'
        ? stored
        : 'hint';
    },
  );
  const [coachLevel, setCoachLevel] = useState<'hint' | 'training' | null>(
    () =>
      window.localStorage.getItem('whistzilla-assistance') === 'training'
        ? 'training'
        : null,
  );
  const [botDifficulty, setBotDifficultyState] = useState<BotDifficulty>(() => {
    const stored = window.localStorage.getItem('whistzilla-bot-difficulty');
    return stored === 'beginner' || stored === 'advanced'
      ? stored
      : 'intermediate';
  });
  const [soundEnabled, setSoundEnabledState] = useState(
    () => window.localStorage.getItem('whistzilla-sound') === 'on',
  );
  const [visibleDealCount, setVisibleDealCount] = useState(0);
  const [lastHumanDecision, setLastHumanDecision] =
    useState<CachedHumanDecision | null>(null);
  const [decisionReviewOpen, setDecisionReviewOpen] = useState(false);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<
    readonly string[]
  >([]);
  const state = session.state;
  const displayedMatchProgress = useMemo(
    () => includeCompletedRound(matchProgress, state),
    [matchProgress, state],
  );
  const displayedDealCount = reducedMotion ? 13 : visibleDealCount;
  const isDealing = displayedDealCount < 13;
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
      if (soundEnabled) playActionSound(command);
      setLastHumanDecision({
        report: createCoachingReport(view, 'training'),
        played: command,
      });
      setDecisionReviewOpen(false);
      setCoachLevel(assistanceMode === 'training' ? 'training' : null);
      setSelectedDiscardIds([]);
      dispatch(command);
    },
    [assistanceMode, dispatch, soundEnabled, view],
  );
  const setBotDifficulty = useCallback((difficulty: BotDifficulty) => {
    window.localStorage.setItem('whistzilla-bot-difficulty', difficulty);
    setBotDifficultyState(difficulty);
  }, []);
  const setAssistanceMode = useCallback((assistance: AssistanceMode) => {
    window.localStorage.setItem('whistzilla-assistance', assistance);
    setAssistanceModeState(assistance);
    setCoachLevel(assistance === 'training' ? 'training' : null);
  }, []);
  const setSoundEnabled = useCallback((enabled: boolean) => {
    window.localStorage.setItem('whistzilla-sound', enabled ? 'on' : 'off');
    setSoundEnabledState(enabled);
  }, []);
  const resetMatchScore = useCallback(() => {
    const progress: MatchProgress = {
      ...EMPTY_MATCH_PROGRESS,
      nextDealer:
        state.phase === 'scoring'
          ? (((state.dealer + 1) % 4) as Seat)
          : state.dealer,
      lastScoredSeed: state.phase === 'scoring' ? state.seed : null,
    };
    setMatchProgress(progress);
    void saveMatchProgress(progress).catch(() =>
      setStorageNotice(
        'Regnskabet blev nulstillet i denne session, men kunne ikke gemmes.',
      ),
    );
  }, [state.dealer, state.phase, state.seed]);

  const startNewGame = useCallback(() => {
    void clearActiveGame().catch(() =>
      setStorageNotice(
        'Det gamle spil kunne ikke fjernes lokalt. Det nye spil fortsætter.',
      ),
    );
    const nextDealer =
      state.phase === 'scoring'
        ? displayedMatchProgress.nextDealer
        : state.dealer;
    setMatchProgress(displayedMatchProgress);
    setSession(newSession(nextDealer));
    setCoachLevel(assistanceMode === 'training' ? 'training' : null);
    setVisibleDealCount(0);
    setLastHumanDecision(null);
    setDecisionReviewOpen(false);
    setSelectedDiscardIds([]);
  }, [assistanceMode, displayedMatchProgress, state.dealer, state.phase]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadActiveGame(),
      loadMatchProgress().catch(() => {
        setStorageNotice(
          'Det gemte regnskab kunne ikke indlæses og blev nulstillet.',
        );
        return EMPTY_MATCH_PROGRESS;
      }),
    ])
      .then(([record, progress]) => {
        if (!active) return;
        setMatchProgress(progress);
        if (record) {
          setSession({ state: replayGame(record), record });
          setVisibleDealCount(13);
        } else {
          setSession(newSession(progress.nextDealer));
          setVisibleDealCount(0);
        }
      })
      .catch(() => {
        setStorageNotice(
          'Det gemte spil kunne ikke indlæses og blev erstattet af et nyt.',
        );
        return clearActiveGame().catch(() => undefined);
      })
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
      void saveMatchProgress(displayedMatchProgress).catch(() =>
        setStorageNotice(
          'Rundens point kunne ikke gemmes permanent, men vises i denne session.',
        ),
      );
      void archiveCompletedGame(session.record)
        .then(clearActiveGame)
        .catch(() =>
          setStorageNotice(
            'Spillet er færdigt, men kunne ikke gemmes i historikken.',
          ),
        );
    } else {
      void saveActiveGame(session.record).catch(() =>
        setStorageNotice(
          'Automatisk lagring er utilgængelig. Du kan fortsætte denne session.',
        ),
      );
    }
  }, [displayedMatchProgress, session, state.phase, storageReady]);

  useEffect(() => {
    const actor =
      state.phase === 'bidding'
        ? state.bidding.actor
        : state.phase === 'trick-play'
          ? state.trickPlay.actor
          : state.phase === 'contract-setup'
            ? view.contractActor
            : null;
    if (!storageReady || isDealing || actor === null || actor === HUMAN_SEAT)
      return;
    const timer = window.setTimeout(
      () => {
        const decision = chooseStrategyAction(
          projectPlayerView(state, actor),
          botDifficulty,
        );
        if (decision) {
          if (soundEnabled) playActionSound(decision.command);
          dispatch(decision.command);
        }
      },
      state.phase === 'bidding'
        ? BOT_BID_DELAY_MS
        : state.phase === 'trick-play' &&
            state.trickPlay.currentTrick.length === 0 &&
            state.trickPlay.completedTricks.length > 0
          ? COMPLETED_TRICK_DELAY_MS
          : BOT_PLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [
    botDifficulty,
    dispatch,
    isDealing,
    state,
    storageReady,
    soundEnabled,
    view.contractActor,
  ]);

  const activeSeat =
    state.phase === 'bidding'
      ? state.bidding.actor
      : state.phase === 'contract-setup'
        ? view.contractActor
        : state.trickPlay.actor;
  const scoreStatus =
    view.score?.status === 'scored'
      ? `${view.score.deltas[HUMAN_SEAT] >= 0 ? '+' : ''}${view.score.deltas[HUMAN_SEAT]} point`
      : `${state.trickPlay.trickCounts[0]} stik`;
  const latestPublicEvent = state.publicEvents.at(-1);
  const displayedTrick =
    view.currentTrick.length > 0
      ? view.currentTrick
      : (state.trickPlay.completedTricks.at(-1)?.cards ?? []);
  const lastCompletedTrick = state.trickPlay.completedTricks.at(-1);
  const lastWinnerCard = lastCompletedTrick?.cards.find(
    ({ seat }) => seat === lastCompletedTrick.winner,
  )?.card;
  const leadCard = view.currentTrick[0]?.card;
  const playableCards = view.legalCommands.filter(
    (command) => command.type === 'play-card',
  );
  const playGuidance =
    state.phase !== 'trick-play' || state.trickPlay.actor !== HUMAN_SEAT
      ? null
      : playableCards.length === 1 &&
          playableCards[0]?.cardId === view.calledPartnerCardId
        ? 'Det kaldte kort skal spilles nu.'
        : leadCard?.kind === 'suited'
          ? view.ownHand.some(
              (card) => card.kind === 'suited' && card.suit === leadCard.suit,
            )
            ? `Bekend ${SUITS[leadCard.suit].label}. ${playableCards.length === 1 ? 'Ét lovligt kort er' : `${playableCards.length} lovlige kort er`} fremhævet.`
            : `Du er renonce i ${SUITS[leadCard.suit].label}. Vælg et valgfrit kort.`
          : leadCard?.kind === 'joker'
            ? 'Joker blev spillet ud. Vælg et lovligt kort.'
            : state.trickPlay.completedTricks.length === 0
              ? 'Første udspil: vælg et kort. Joker kan ikke spilles ud endnu.'
              : 'Din tur til at spille ud. Vælg et kort.';
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
        ? `Stik ${state.trickPlay.completedTricks.length + 1} af 13 · ${state.trickPlay.actor === HUMAN_SEAT ? 'Din tur' : `${PLAYER_NAMES[state.trickPlay.actor]} spiller`}`
        : state.phase === 'contract-setup' && state.winningBid
          ? `${bidLabel(state.winningBid)} · vælg kontrakten`
          : biddingStatus;
  const displayedBid =
    state.phase === 'bidding' ? state.bidding.currentBid : state.winningBid;
  const displayedBidder =
    state.phase === 'bidding' ? state.bidding.bidHolder : state.declarer;
  const recommendedCommand =
    coachLevel === 'training'
      ? createCoachingReport(view, 'training').recommended?.command
      : null;
  const recommendedCardId =
    recommendedCommand?.type === 'play-card' ? recommendedCommand.cardId : null;

  return (
    <main className="game-page">
      <header className="topbar">
        <div className="game-brand">
          <Link className="icon-button" to="/" aria-label="Til forsiden">
            <House size={19} />
          </Link>
          <h1>Whistzilla</h1>
        </div>
        <div className="match-summary" aria-label="Samlet regnskab">
          <small>
            Runde{' '}
            {state.phase === 'scoring'
              ? displayedMatchProgress.rounds
              : displayedMatchProgress.rounds + 1}
          </small>
          <span>
            {displayedMatchProgress.scores.map((score, seat) => (
              <b key={seat} title={PLAYER_NAMES[seat]}>
                {seat === HUMAN_SEAT ? 'Dig' : seat + 1}:{score}
              </b>
            ))}
          </span>
        </div>
        <div className="topbar-actions">
          <ReplayLibrary />
          <SettingsDialog
            difficulty={botDifficulty}
            setDifficulty={setBotDifficulty}
            assistance={assistanceMode}
            setAssistance={setAssistanceMode}
            resetScore={resetMatchScore}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
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
      <div
        className="contract-strip"
        role="region"
        aria-label={state.phase === 'bidding' ? 'Aktuel melding' : 'Kontrakt'}
      >
        <span className="contract-strip-label">
          {state.phase === 'bidding' ? 'Aktuel melding' : 'Kontrakt'}
        </span>
        <strong>
          {displayedBid ? bidLabel(displayedBid) : 'Ingen melding endnu'}
        </strong>
        {displayedBidder !== null && (
          <span>meldt af {PLAYER_NAMES[displayedBidder]}</span>
        )}
        {state.phase === 'bidding' && (
          <span className="contract-strip-next">
            Tur: {PLAYER_NAMES[state.bidding.actor]}
          </span>
        )}
      </div>
      {storageNotice && (
        <div className="storage-notice" role="status">
          <span>{storageNotice}</span>
          <button
            type="button"
            aria-label="Luk lagringsbesked"
            onClick={() => setStorageNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
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
            <div
              className="current-trick"
              aria-label={
                view.currentTrick.length > 0 ? 'Aktuelt stik' : 'Seneste stik'
              }
            >
              {displayedTrick.map(({ seat, card }) => (
                <div
                  className={`trick-card trick-seat-${seat} ${view.currentTrick.length === 0 && lastCompletedTrick?.winner === seat ? 'trick-card-winner' : ''}`}
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
          <p aria-live="polite">{status}</p>
          {lastCompletedTrick && lastWinnerCard && (
            <span className="trick-result" aria-label="Sidste stik">
              Sidste stik: {PLAYER_NAMES[lastCompletedTrick.winner]} vandt med{' '}
              {cardLabel(lastWinnerCard)}
            </span>
          )}
          {view.openHands.length > 0 && (
            <div className="open-hands" aria-label="Åbne hænder">
              {view.openHands.map((openHand) => (
                <div className="open-hand" key={openHand.seat}>
                  <span>{PLAYER_NAMES[openHand.seat]}</span>
                  <div>
                    {[...openHand.cards].sort(compareHandCards).map((card) => (
                      <CardVisual card={card} key={card.id} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
        {playGuidance && (
          <div className="play-guidance" aria-label="Spilvejledning">
            {playGuidance}
          </div>
        )}
        <div className="hand">
          {sortedHand.slice(0, displayedDealCount).map((card) => {
            const command = view.legalCommands.find(
              (
                candidate,
              ): candidate is Extract<GameCommand, { type: 'play-card' }> =>
                candidate.type === 'play-card' && candidate.cardId === card.id,
            );
            const selectingExchange =
              state.phase === 'contract-setup' &&
              view.contractActor === HUMAN_SEAT &&
              view.legalCommands.some(
                (candidate) =>
                  candidate.type === 'exchange-cards' ||
                  candidate.type === 'skip-exchange',
              );
            const selectedForExchange = selectedDiscardIds.includes(card.id);
            return (
              <button
                type="button"
                className={`hand-card ${recommendedCardId === card.id ? 'recommended-card' : ''} ${selectedForExchange ? 'selected-exchange-card' : ''}`}
                aria-label={
                  selectingExchange
                    ? `Vælg ${cardLabel(card)} til bytning`
                    : `Spil ${cardLabel(card)}`
                }
                aria-pressed={
                  selectingExchange ? selectedForExchange : undefined
                }
                disabled={!command && !selectingExchange}
                key={card.id}
                onClick={() => {
                  if (selectingExchange) {
                    setSelectedDiscardIds((ids) =>
                      selectedForExchange
                        ? ids.filter((id) => id !== card.id)
                        : ids.length < 3
                          ? [...ids, card.id]
                          : ids,
                    );
                  } else if (command) {
                    dispatchHuman(command);
                  }
                }}
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
          <ContractControls
            state={state}
            dispatch={dispatchHuman}
            selectedDiscardIds={selectedDiscardIds}
            setSelectedDiscardIds={setSelectedDiscardIds}
          />
        ) : state.phase === 'scoring' ? (
          <div className="round-result" aria-label="Rundens resultat">
            {view.score?.status === 'scored' && (
              <>
                <strong>
                  {view.score.contractSucceeded
                    ? 'Kontrakten blev vundet'
                    : 'Kontrakten blev tabt'}
                </strong>
                <div className="round-score-grid">
                  {view.score.deltas.map((delta, seat) => (
                    <span key={seat}>
                      {PLAYER_NAMES[seat]}
                      <b>{delta >= 0 ? `+${delta}` : delta}</b>
                    </span>
                  ))}
                </div>
                <span className="match-round-count">
                  Samlet efter {displayedMatchProgress.rounds}{' '}
                  {displayedMatchProgress.rounds === 1 ? 'runde' : 'runder'}
                </span>
                <div className="round-score-grid match-score-grid">
                  {displayedMatchProgress.scores.map((score, seat) => (
                    <span key={seat}>
                      {PLAYER_NAMES[seat]}
                      <b>{score >= 0 ? `+${score}` : score}</b>
                    </span>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              className="primary-button"
              onClick={startNewGame}
            >
              Næste spil
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
      <CoachPanel
        view={view}
        level={coachLevel}
        setLevel={setCoachLevel}
        mode={assistanceMode}
      />
      <DecisionReview
        decision={lastHumanDecision}
        open={decisionReviewOpen}
        setOpen={setDecisionReviewOpen}
      />
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/training" element={<GamePage />} />
        <Route path="/multiplayer" element={<MultiplayerLobbyPage />} />
        <Route path="/multiplayer/:tableId" element={<MultiplayerRoomPage />} />
        <Route path="/points" element={<PointsCalculatorPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
