import type { ReplayRecord } from '@whistzilla/game-core';
import { z } from 'zod';

const DATABASE_NAME = 'whistzilla';
const DATABASE_VERSION = 1;
const ACTIVE_STORE = 'active-game';
const REPLAY_STORE = 'completed-replays';
const ACTIVE_KEY = 'current';

const seatSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
const revisionSchema = z.number().int().nonnegative();
const bidSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('numerical'),
    level: z.union([
      z.literal(7),
      z.literal(8),
      z.literal(9),
      z.literal(10),
      z.literal(11),
      z.literal(12),
      z.literal(13),
    ]),
    bidType: z.enum(['ordinary', 'halves', 'good', 'vip']),
  }),
  z.object({
    kind: z.literal('special'),
    bidType: z.enum(['sol', 'pure-sol', 'open-laydown', 'super-laydown']),
  }),
]);
const commandBase = { actor: seatSchema, expectedRevision: revisionSchema };
const commandSchema = z.discriminatedUnion('type', [
  z.object({ ...commandBase, type: z.literal('place-bid'), bid: bidSchema }),
  z.object({ ...commandBase, type: z.literal('pass') }),
  z.object({
    ...commandBase,
    type: z.literal('choose-trump'),
    trump: z.enum(['clubs', 'diamonds', 'hearts', 'spades']),
  }),
  z.object({
    ...commandBase,
    type: z.literal('call-partner'),
    cardId: z.string().min(1),
  }),
  z.object({ ...commandBase, type: z.literal('skip-exchange') }),
  z.object({
    ...commandBase,
    type: z.literal('play-card'),
    cardId: z.string().min(1),
  }),
]);
const replayRecordSchema = z.object({
  schemaVersion: z.literal(1),
  config: z.object({
    seed: z.number().int().min(0).max(0xffff_ffff),
    dealer: seatSchema,
    host: seatSchema,
  }),
  commands: z.array(commandSchema),
});
const archivedReplaySchema = z.object({
  id: z.string(),
  completedAt: z.string().datetime(),
  record: replayRecordSchema,
});

export interface ArchivedReplay {
  readonly id: string;
  readonly completedAt: string;
  readonly record: ReplayRecord;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(ACTIVE_STORE)) {
      database.createObjectStore(ACTIVE_STORE);
    }
    if (!database.objectStoreNames.contains(REPLAY_STORE)) {
      database.createObjectStore(REPLAY_STORE, { keyPath: 'id' });
    }
  };
  return requestResult(request);
}

export async function loadActiveGame(): Promise<ReplayRecord | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ACTIVE_STORE, 'readonly');
    const raw: unknown = await requestResult<unknown>(
      transaction.objectStore(ACTIVE_STORE).get(ACTIVE_KEY),
    );
    await transactionComplete(transaction);
    return raw === undefined
      ? null
      : (replayRecordSchema.parse(raw) as ReplayRecord);
  } finally {
    database.close();
  }
}

export async function saveActiveGame(record: ReplayRecord): Promise<void> {
  const validated = replayRecordSchema.parse(record);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ACTIVE_STORE, 'readwrite');
    transaction.objectStore(ACTIVE_STORE).put(validated, ACTIVE_KEY);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function clearActiveGame(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ACTIVE_STORE, 'readwrite');
    transaction.objectStore(ACTIVE_STORE).delete(ACTIVE_KEY);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function archiveCompletedGame(
  record: ReplayRecord,
): Promise<void> {
  const validated = replayRecordSchema.parse(record) as ReplayRecord;
  const archived: ArchivedReplay = {
    id: `game-${record.config.seed}`,
    completedAt: new Date().toISOString(),
    record: validated,
  };
  archivedReplaySchema.parse(archived);

  const database = await openDatabase();
  try {
    const transaction = database.transaction(REPLAY_STORE, 'readwrite');
    transaction.objectStore(REPLAY_STORE).put(archived);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function listCompletedGames(): Promise<readonly ArchivedReplay[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(REPLAY_STORE, 'readonly');
    const raw: unknown = await requestResult(
      transaction.objectStore(REPLAY_STORE).getAll(),
    );
    await transactionComplete(transaction);
    return (z.array(archivedReplaySchema).parse(raw) as ArchivedReplay[]).sort(
      (left, right) => right.completedAt.localeCompare(left.completedAt),
    );
  } finally {
    database.close();
  }
}

export async function resetGameStorage(): Promise<void> {
  const database = await openDatabase();
  database.close();
  await requestResult(indexedDB.deleteDatabase(DATABASE_NAME));
}
