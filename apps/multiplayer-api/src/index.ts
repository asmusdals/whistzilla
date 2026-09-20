import { DurableObject } from 'cloudflare:workers';

import { TableService, type TableRecord } from '@whistzilla/multiplayer/tables';

interface Env {
  TABLES: DurableObjectNamespace<TableHub>;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  headers.set('access-control-allow-headers', 'authorization, content-type');
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const stream = request.body as ReadableStream<Uint8Array> | null;
    const reader = stream?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function field(data: Record<string, unknown> | null, name: string): string {
  const value = data?.[name];
  return typeof value === 'string' ? value : '';
}

function credential(request: Request): string | null {
  return (
    request.headers
      .get('authorization')
      ?.match(/^Bearer ([0-9a-f]{64})$/)?.[1] ?? null
  );
}

export class TableHub extends DurableObject<Env> {
  private service = new TableService();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.service = new TableService(
        (await ctx.storage.get<TableRecord[]>('tables')) ?? [],
      );
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const now = Date.now();
    this.service.tick(now);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[2];
    const action = parts[3];
    const auth = credential(request);
    let response: Response;

    if (parts.length === 2 && request.method === 'GET') {
      response = json({ tables: this.service.list(now) });
    } else if (parts.length === 2 && request.method === 'POST') {
      const data = await body(request);
      const created = this.service.create(
        field(data, 'name'),
        field(data, 'tag'),
        now,
      );
      response = created.ok ? json(created.value, 201) : json(created, 400);
    } else if (!id) {
      response = json({ error: 'not-found' }, 404);
    } else if (action === 'join' && request.method === 'POST') {
      const data = await body(request);
      const joined = this.service.join(id, field(data, 'tag'), now);
      response = joined.ok ? json(joined.value, 201) : json(joined, 400);
    } else if (!auth) {
      response = json({ error: 'seat-not-found' }, 401);
    } else if (!action && request.method === 'GET') {
      const viewed = this.service.view(id, auth, now);
      response = viewed.ok ? json(viewed.value) : json(viewed, 404);
    } else if (action === 'start' && request.method === 'POST') {
      const started = this.service.start(id, auth, now);
      response = started.ok ? json({ started: true }) : json(started, 409);
    } else if (action === 'action' && request.method === 'POST') {
      const data = await body(request);
      const viewed = this.service.view(id, auth, now);
      if (!viewed.ok || !viewed.value.game) {
        response = json({ error: 'seat-not-found' }, 401);
      } else if (data?.revision !== viewed.value.game.revision) {
        response = json({ error: 'stale-command' }, 409);
      } else if (!Number.isInteger(data?.index)) {
        response = json({ error: 'invalid-input' }, 400);
      } else {
        const command = viewed.value.game.legalCommands[data.index as number];
        const submitted = command
          ? this.service.submit(id, auth, command, now)
          : { ok: false as const, error: 'invalid-input' };
        response = submitted.ok
          ? json({ accepted: true })
          : json(submitted, 409);
      }
    } else if (action === 'chat' && request.method === 'POST') {
      const data = await body(request);
      const sent = this.service.chat(id, auth, field(data, 'text'), now);
      response = sent.ok ? json(sent.value, 201) : json(sent, 400);
    } else if (action === 'end' && request.method === 'POST') {
      const ended = this.service.end(id, auth, now);
      response = ended.ok ? json({ ended: true }) : json(ended, 409);
    } else {
      response = json({ error: 'not-found' }, 404);
    }

    await this.persist(now);
    return response;
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    this.service.tick(now);
    await this.persist(now);
  }

  private async persist(now: number): Promise<void> {
    await this.ctx.storage.put('tables', this.service.snapshot());
    const next = this.service.nextDeadline(now);
    if (next !== null) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS')
      return cors(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    if (url.pathname === '/health') return cors(json({ ok: true }));
    if (
      url.pathname !== '/api/tables' &&
      !url.pathname.startsWith('/api/tables/')
    )
      return cors(json({ error: 'not-found' }, 404));
    try {
      return cors(await env.TABLES.getByName('all-tables').fetch(request));
    } catch {
      return cors(json({ error: 'service-unavailable' }, 503));
    }
  },
} satisfies ExportedHandler<Env>;
