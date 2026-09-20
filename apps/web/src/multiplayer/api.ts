import type { TableSummary, TableView } from '@whistzilla/multiplayer/tables';

const configuredBase = (import.meta.env as Record<string, unknown>)[
  'VITE_MULTIPLAYER_API_URL'
];
const base =
  typeof configuredBase === 'string' ? configuredBase.replace(/\/$/, '') : '';

async function request<T>(
  path: string,
  token?: string,
  data?: object,
): Promise<T> {
  const response = await fetch(`${base}/api/tables${path}`, {
    method: data ? 'POST' : 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'content-type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error =
      result && typeof result === 'object' && 'error' in result
        ? String(result.error)
        : 'service-unavailable';
    throw new Error(error);
  }
  return result as T;
}

export const multiplayerApi = {
  list: () => request<{ tables: TableSummary[] }>('', undefined),
  create: (name: string, tag: string) =>
    request<{ id: string; token: string; seat: number }>('', undefined, {
      name,
      tag,
    }),
  join: (id: string, tag: string) =>
    request<{ token: string; seat: number | null }>(`/${id}/join`, undefined, {
      tag,
    }),
  view: (id: string, token: string) => request<TableView>(`/${id}`, token),
  start: (id: string, token: string) => request(`/${id}/start`, token, {}),
  action: (id: string, token: string, revision: number, index: number) =>
    request(`/${id}/action`, token, { revision, index }),
  chat: (id: string, token: string, text: string) =>
    request(`/${id}/chat`, token, { text }),
  end: (id: string, token: string) => request(`/${id}/end`, token, {}),
};

export function savedToken(id: string): string | null {
  return window.localStorage.getItem(`whistzilla-table:${id}`);
}

export function saveToken(id: string, token: string): void {
  window.localStorage.setItem(`whistzilla-table:${id}`, token);
}
