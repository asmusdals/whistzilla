import { randomBytes } from 'node:crypto';

import {
  applyCommand,
  createGame,
  projectPlayerView,
  SEATS,
  type GameCommand,
  type GameConfig,
  type GameState,
  type PlayerView,
  type PublicGameEvent,
  type RuleViolationCode,
  type Seat,
} from '@whistzilla/game-core';

interface Room {
  state: GameState;
  tokens: Map<string, Seat>;
}

export type RoomError =
  | 'room-not-found'
  | 'room-full'
  | 'seat-not-found'
  | 'room-waiting-for-players'
  | 'wrong-seat'
  | RuleViolationCode;

export type RoomResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RoomError };

const success = <T>(value: T): RoomResult<T> => ({ ok: true, value });
const failure = <T>(error: RoomError): RoomResult<T> => ({ ok: false, error });

// This service owns authoritative state. Its public methods return only room
// metadata, a seat token, public events, and the caller's projected view.
// Durable storage and transport will wrap this boundary in the next slice.
export class RoomService {
  private readonly rooms = new Map<string, Room>();

  createRoom(config: GameConfig): { readonly roomId: string } {
    const roomId = randomBytes(16).toString('base64url');
    this.rooms.set(roomId, { state: createGame(config), tokens: new Map() });
    return { roomId };
  }

  joinRoom(roomId: string): RoomResult<{
    readonly seat: Seat;
    readonly seatToken: string;
    readonly occupiedSeats: readonly Seat[];
  }> {
    const room = this.rooms.get(roomId);
    if (!room) return failure('room-not-found');
    const seat = SEATS.find(
      (candidate) => ![...room.tokens.values()].includes(candidate),
    );
    if (seat === undefined) return failure('room-full');
    const seatToken = randomBytes(32).toString('base64url');
    room.tokens.set(seatToken, seat);
    return success({
      seat,
      seatToken,
      occupiedSeats: [...room.tokens.values()],
    });
  }

  view(roomId: string, seatToken: string): RoomResult<PlayerView> {
    const room = this.rooms.get(roomId);
    if (!room) return failure('room-not-found');
    const seat = room.tokens.get(seatToken);
    if (seat === undefined) return failure('seat-not-found');
    return success(projectPlayerView(room.state, seat));
  }

  submit(
    roomId: string,
    seatToken: string,
    command: GameCommand,
  ): RoomResult<{
    readonly view: PlayerView;
    readonly events: readonly PublicGameEvent[];
  }> {
    const room = this.rooms.get(roomId);
    if (!room) return failure('room-not-found');
    const seat = room.tokens.get(seatToken);
    if (seat === undefined) return failure('seat-not-found');
    if (room.tokens.size !== SEATS.length)
      return failure('room-waiting-for-players');
    if (command.actor !== seat) return failure('wrong-seat');
    const transition = applyCommand(room.state, command);
    if (!transition.ok) return failure(transition.error.code);
    room.state = transition.state;
    return success({
      view: projectPlayerView(room.state, seat),
      events: transition.events,
    });
  }
}
