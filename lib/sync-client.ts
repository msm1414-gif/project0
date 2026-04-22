import type { Event, Todo } from './types';

export interface CloudSnapshot {
  events: Event[];
  todos: Todo[];
  updatedAt: number;
  empty: boolean;
}

export async function syncEventsToCloud(token: string, events: Event[], todos: Todo[]) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, events, todos }),
  });
  const data = (await res.json()) as { ok: boolean; count?: number; error?: string };
  if (!data.ok) throw new Error(data.error ?? '同期に失敗しました');
  return data.count ?? events.length;
}

export async function pullFromCloud(token: string): Promise<CloudSnapshot> {
  const res = await fetch(`/api/sync?token=${encodeURIComponent(token)}`);
  const data = (await res.json()) as {
    ok: boolean;
    empty?: boolean;
    events?: Event[];
    todos?: Todo[];
    updatedAt?: number;
    error?: string;
  };
  if (!data.ok) throw new Error(data.error ?? '取得に失敗しました');
  return {
    events: data.events ?? [],
    todos: data.todos ?? [],
    updatedAt: data.updatedAt ?? 0,
    empty: !!data.empty,
  };
}

export function icsUrlFor(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/ics/${token}.ics`;
}

export function shareUrlFor(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?t=${token}`;
}
