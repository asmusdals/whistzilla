import { describe, expect, it } from 'vitest';

import { RoomService } from './index';

function joinedRoom() {
  const service = new RoomService();
  const { roomId } = service.createRoom({ seed: 42, dealer: 3, host: 0 });
  const seats = [0, 1, 2, 3].map(() => service.joinRoom(roomId));
  if (seats.some((result) => !result.ok)) throw new Error('Join failed');
  return { service, roomId, seats };
}

describe('authoritative multiplayer room', () => {
  it('gives four visitors distinct seats and private reconnect tokens', () => {
    const { service, roomId, seats } = joinedRoom();
    expect(seats.map((result) => result.ok && result.value.seat)).toEqual([
      0, 1, 2, 3,
    ]);
    const tokens = seats.map((result) => result.ok && result.value.seatToken);
    expect(new Set(tokens).size).toBe(4);
    expect(service.joinRoom(roomId)).toEqual({ ok: false, error: 'room-full' });
    expect(service.view(roomId, 'invalid')).toEqual({
      ok: false,
      error: 'seat-not-found',
    });
  });

  it('waits for four players and validates seat ownership and revisions', () => {
    const service = new RoomService();
    const { roomId } = service.createRoom({ seed: 42, dealer: 3, host: 0 });
    const first = service.joinRoom(roomId);
    if (!first.ok) throw new Error('Join failed');
    const opening = service.view(roomId, first.value.seatToken).ok;
    expect(opening).toBe(true);
    const command = {
      type: 'place-bid' as const,
      actor: 0 as const,
      expectedRevision: 0,
      bid: {
        kind: 'numerical' as const,
        level: 7 as const,
        bidType: 'ordinary' as const,
      },
    };
    expect(service.submit(roomId, first.value.seatToken, command)).toEqual({
      ok: false,
      error: 'room-waiting-for-players',
    });
    const others = [0, 1, 2].map(() => service.joinRoom(roomId));
    const second = others[0];
    if (!second?.ok) throw new Error('Join failed');
    expect(service.submit(roomId, second.value.seatToken, command)).toEqual({
      ok: false,
      error: 'wrong-seat',
    });
    const accepted = service.submit(roomId, first.value.seatToken, command);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.value.view.revision).toBe(1);
      expect(accepted.value.events[0]?.type).toBe('bid-placed');
    }
    expect(service.submit(roomId, first.value.seatToken, command)).toEqual({
      ok: false,
      error: 'stale-command',
    });
  });

  it("never returns another seat's hidden cards in a projected view", () => {
    const { service, roomId, seats } = joinedRoom();
    const first = seats[0];
    const second = seats[1];
    if (!first?.ok || !second?.ok) throw new Error('Join failed');
    const own = service.view(roomId, first.value.seatToken);
    const other = service.view(roomId, second.value.seatToken);
    if (!own.ok || !other.ok) throw new Error('View failed');
    expect(own.value.ownHand).toHaveLength(13);
    expect(other.value.ownHand).toHaveLength(13);
    expect(own.value.openHands).toEqual([]);
    const wirePayload = JSON.stringify(own.value);
    for (const card of other.value.ownHand)
      expect(wirePayload).not.toContain(`"id":"${card.id}"`);
    expect(wirePayload).not.toContain(first.value.seatToken);
    expect(wirePayload).not.toContain(second.value.seatToken);
  });
});
