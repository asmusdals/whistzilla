import {
  applyCommand,
  createGame,
  type GameCommand,
  type GameConfig,
  type GameState,
} from './game';

export interface ReplayRecord {
  readonly schemaVersion: 1;
  readonly config: GameConfig;
  readonly commands: readonly GameCommand[];
}

export function replayGame(record: ReplayRecord): GameState {
  let state = createGame(record.config);

  for (const command of record.commands) {
    const result = applyCommand(state, command);

    if (!result.ok) {
      throw new Error(`Replay command was rejected: ${result.error.code}`);
    }

    state = result.state;
  }

  return state;
}
