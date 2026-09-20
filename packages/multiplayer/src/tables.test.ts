import { chooseStrategyAction } from '@whistzilla/strategy';
import { describe, expect, it } from 'vitest';

import { TableService } from './tables';

function created() {
  const service = new TableService();
  const result = service.create('Fredagswhist', 'Asmus', 0);
  if (!result.ok) throw new Error(result.error);
  return { service, ...result.value };
}

describe('public multiplayer tables', () => {
  it('lists named rooms, assigns seats, and starts with bots in unfilled places', () => {
    const { service, id, token } = created();
    const guest = service.join(id, 'Layla', 0);
    expect(guest).toMatchObject({ ok: true, value: { seat: 1 } });
    expect(service.list(0)).toMatchObject([
      { id, name: 'Fredagswhist', status: 'lobby', humanCount: 2 },
    ]);
    expect(service.join(id, 'layla', 0)).toEqual({
      ok: false,
      error: 'already-joined',
    });
    expect(service.start(id, 'invalid', 0)).toEqual({
      ok: false,
      error: 'not-host',
    });
    expect(service.start(id, token, 0)).toEqual({ ok: true, value: true });
    const view = service.view(id, token, 0);
    expect(view.ok && view.value.table.status).toBe('playing');
    expect(
      view.ok && view.value.players.filter(({ isBot }) => isBot),
    ).toHaveLength(2);
  });

  it('keeps hands and seat tokens private and rejects wrong-seat actions', () => {
    const { service, id, token } = created();
    const guest = service.join(id, 'Layla', 0);
    if (!guest.ok) throw new Error(guest.error);
    service.start(id, token, 0);
    const first = service.view(id, token, 1);
    const second = service.view(id, guest.value.token, 1);
    if (!first.ok || !second.ok || !first.value.game || !second.value.game)
      throw new Error('Missing seat projection');
    const serialized = JSON.stringify(first.value);
    for (const card of second.value.game.ownHand)
      expect(serialized).not.toContain(`"id":"${card.id}"`);
    expect(serialized).not.toContain(guest.value.token);
    expect(serialized).not.toContain(token);
    const command = first.value.game.legalCommands[0];
    if (!command) throw new Error('Missing legal command');
    expect(service.submit(id, guest.value.token, command, 1)).toEqual({
      ok: false,
      error: 'wrong-seat',
    });
  });

  it('uses a legal fallback after 45 seconds and gives a disconnected seat to a bot after one minute', () => {
    const { service, id, token } = created();
    service.start(id, token, 0);
    let now = 0;
    for (let step = 0; step < 30; step += 1) {
      const result = service.view(id, token, now);
      if (!result.ok || !result.value.game) throw new Error('No game view');
      if (result.value.game.phase === 'trick-play') break;
      const command = chooseStrategyAction(
        result.value.game,
        'intermediate',
      )?.command;
      if (!command) throw new Error('Missing decision');
      expect(service.submit(id, token, command, now).ok).toBe(true);
      now += 1;
    }
    const before = service.view(id, token, now);
    if (!before.ok || !before.value.game) throw new Error('No game view');
    expect(before.value.game.phase).toBe('trick-play');
    const revision = before.value.game.revision;
    service.tick(now + 45_001);
    const after = service.view(id, token, now + 45_001);
    if (!after.ok || !after.value.game) throw new Error('No game view');
    expect(after.value.game.revision).toBeGreaterThan(revision);
    service.tick(now + 106_002);
    const table = service.snapshot()[0];
    expect(table?.seats[0]).toBeNull();
  });

  it('queues newcomers for the next round and persists chat and scores in a snapshot', () => {
    const { service, id, token } = created();
    service.start(id, token, 0);
    const newcomer = service.join(id, 'Messi', 1);
    expect(newcomer).toMatchObject({ ok: true, value: { seat: null } });
    expect(service.chat(id, token, 'Hej bord!', 2)).toMatchObject({
      ok: true,
      value: { tag: 'Asmus', text: 'Hej bord!' },
    });
    const restored = new TableService(service.snapshot());
    expect(restored.list(3)[0]).toMatchObject({ waitingCount: 1 });
    const waiting = newcomer.ok && restored.view(id, newcomer.value.token, 3);
    expect(waiting && waiting.ok && waiting.value.game).toBeNull();
    expect(restored.end(id, token, 4)).toEqual({ ok: true, value: true });
    expect(restored.list(4)).toEqual([]);
  });

  it('stops a bot-only table after every human misses the reconnect window', () => {
    const { service, id, token } = created();
    service.start(id, token, 0);
    service.tick(60_001);
    expect(service.list(60_001)).toEqual([]);
    expect(service.snapshot().find((table) => table.id === id)?.status).toBe(
      'finished',
    );
  });

  it('hands host control to a connected player when the creator disconnects', () => {
    const { service, id, token } = created();
    const joined = service.join(id, 'Layla', 0);
    if (!joined.ok) throw new Error(joined.error);
    service.start(id, token, 0);
    service.view(id, joined.value.token, 30_000);
    service.tick(60_001);
    const guest = service.view(id, joined.value.token, 60_001);
    expect(guest.ok && guest.value.isHost).toBe(true);
    expect(service.end(id, token, 60_001)).toEqual({
      ok: false,
      error: 'not-host',
    });
    expect(service.end(id, joined.value.token, 60_001)).toEqual({
      ok: true,
      value: true,
    });
  });

  it('shows the just-completed trick briefly without exposing a browsable card history', () => {
    const { service, id, token } = created();
    const tokens = [token];
    for (const tag of ['Layla', 'Messi', 'Ronaldo']) {
      const joined = service.join(id, tag, 0);
      if (!joined.ok) throw new Error(joined.error);
      tokens.push(joined.value.token);
    }
    service.start(id, token, 0);
    let completedAt = 0;
    for (let step = 1; step < 80; step += 1) {
      const views = tokens.map((seatToken) =>
        service.view(id, seatToken, step),
      );
      const active = views.find(
        (result) => result.ok && result.value.game?.legalCommands.length,
      );
      if (!active?.ok || !active.value.game || active.value.seat === null)
        throw new Error('Expected an active seat');
      const game = active.value.game;
      const command =
        step === 1
          ? game.legalCommands.find(
              (candidate) =>
                candidate.type === 'place-bid' &&
                candidate.bid.kind === 'numerical' &&
                candidate.bid.level === 7 &&
                candidate.bid.bidType === 'ordinary',
            )
          : game.phase === 'bidding'
            ? game.legalCommands.find((candidate) => candidate.type === 'pass')
            : chooseStrategyAction(game, 'intermediate')?.command;
      if (!command) throw new Error('Missing action');
      expect(
        service.submit(id, tokens[active.value.seat]!, command, step).ok,
      ).toBe(true);
      const after = service.view(id, token, step);
      if (after.ok && after.value.game?.completedTrickCount) {
        completedAt = step;
        break;
      }
    }
    expect(completedAt).toBeGreaterThan(0);
    const recent = service.view(id, token, completedAt);
    if (!recent.ok || !recent.value.game) throw new Error('Missing view');
    expect(recent.value.recentTrick).toHaveLength(4);
    expect(
      recent.value.game.publicEvents.some(
        (event) => event.type === 'card-played',
      ),
    ).toBe(false);
    const later = service.view(id, token, completedAt + 2_501);
    expect(later.ok && later.value.recentTrick).toEqual([]);
  });
});
