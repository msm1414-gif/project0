import type { Event } from './types';

export async function syncEventsToCloud(token: string, events: Event[]) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, events }),
  });
  const data = (await res.json()) as { ok: boolean; count?: number; error?: string };
  if (!data.ok) throw new Error(data.error ?? '同期に失敗しました');
  return data.count ?? events.length;
}

export function icsUrlFor(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/ics/${token}.ics`;
}
