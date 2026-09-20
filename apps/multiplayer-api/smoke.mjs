import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8787/api/tables';

function findCard(value, id, path = '') {
  if (!value || typeof value !== 'object') return null;
  if (value.id === id) return path;
  for (const [key, child] of Object.entries(value)) {
    const found = findCard(child, id, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

async function call(path, token, data) {
  const response = await fetch(`${base}${path}`, {
    method: data ? 'POST' : 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'content-type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json();
  assert.equal(response.ok, true, JSON.stringify(body));
  return body;
}

const created = await call('', null, { name: 'Lokal test', tag: 'Asmus' });
const tokens = [created.token];
for (const tag of ['Layla', 'Messi', 'Ronaldo']) {
  const joined = await call(`/${created.id}/join`, null, { tag });
  tokens.push(joined.token);
}
const listed = await call('', null);
assert.equal(
  listed.tables.some(({ id }) => id === created.id),
  true,
);
await call(`/${created.id}/start`, tokens[0], {});
let rounds = 0;
for (let move = 0; move < 120; move += 1) {
  const views = await Promise.all(
    tokens.map((token) => call(`/${created.id}`, token)),
  );
  for (const view of views) {
    assert.ok(view.game.openHands.length <= 1);
    if (view.game.openHands.length)
      assert.equal(view.game.openHands[0].seat, view.game.declarer);
    for (const other of views) {
      if (other.seat === view.seat) continue;
      if (view.game.openHands.some(({ seat }) => seat === other.seat)) continue;
      for (const card of other.game.ownHand) {
        assert.equal(
          JSON.stringify(view).includes(`"id":"${card.id}"`),
          false,
          `Seat ${view.seat} received ${card.id} from seat ${other.seat} during ${view.game.phase} at ${findCard(view, card.id)}`,
        );
      }
    }
  }
  if (views[0].game.phase === 'scoring') {
    rounds += 1;
    break;
  }
  const active = views.find((view) => view.game?.legalCommands.length > 0);
  assert.ok(active?.game, 'No active player');
  await call(`/${created.id}/action`, tokens[active.seat], {
    revision: active.game.revision,
    index: 0,
  });
}
assert.equal(rounds, 1, 'A complete round did not finish');
const final = await call(`/${created.id}`, tokens[0]);
assert.equal(final.table.round, 1);
assert.equal(
  final.scores.some((score) => score !== 0),
  true,
);
await call(`/${created.id}/chat`, tokens[0], { text: 'God runde!' });
const chatted = await call(`/${created.id}`, tokens[1]);
assert.equal(chatted.messages.at(-1)?.text, 'God runde!');
await call(`/${created.id}/end`, tokens[0], {});
console.log(
  'Multiplayer API smoke passed: four seats, full round, private hands, score, chat, end.',
);
