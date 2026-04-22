import { create } from 'zustand';
import type { Event, Todo } from './types';
import * as db from './db';
import { loadSettings } from './settings';
import { pullFromCloud, syncEventsToCloud } from './sync-client';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePush(events: Event[], todos: Todo[]) {
  if (typeof window === 'undefined') return;
  const { shareToken } = loadSettings();
  if (!shareToken) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncEventsToCloud(shareToken, events, todos).catch(() => {
      /* silent retry on next mutation */
    });
  }, 1500);
}

interface AppState {
  hydrated: boolean;
  events: Event[];
  todos: Todo[];
  lastSyncedAt: number | null;
  hydrate: () => Promise<void>;
  pullNow: () => Promise<{ ok: boolean; empty?: boolean; error?: string }>;
  pushNow: () => Promise<{ ok: boolean; error?: string }>;
  addEvent: (input: Omit<Event, 'id' | 'createdAt'>) => Event;
  addEvents: (list: Omit<Event, 'id' | 'createdAt'>[]) => Event[];
  updateEvent: (id: string, patch: Partial<Omit<Event, 'id' | 'createdAt'>>) => void;
  removeEvent: (id: string) => void;
  removeGroup: (groupId: string) => void;
  addTodo: (title: string) => Todo;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  events: [],
  todos: [],
  lastSyncedAt: null,
  hydrate: async () => {
    if (get().hydrated) return;
    let events: Event[] = [];
    let todos: Todo[] = [];
    try {
      [events, todos] = await Promise.all([db.loadAllEvents(), db.loadAllTodos()]);
    } catch {
      /* first run */
    }
    set({ events, todos, hydrated: true });
    const { shareToken } = loadSettings();
    if (shareToken) {
      try {
        const snap = await pullFromCloud(shareToken);
        if (!snap.empty) {
          set({ events: snap.events, todos: snap.todos, lastSyncedAt: snap.updatedAt });
          await db.replaceAll(snap.events, snap.todos).catch(() => {});
        } else {
          void syncEventsToCloud(shareToken, events, todos).catch(() => {});
        }
      } catch {
        /* offline: local data is fine */
      }
    }
  },
  pullNow: async () => {
    const { shareToken } = loadSettings();
    if (!shareToken) return { ok: false, error: '共有トークンが未設定です' };
    try {
      const snap = await pullFromCloud(shareToken);
      if (snap.empty) return { ok: true, empty: true };
      set({ events: snap.events, todos: snap.todos, lastSyncedAt: snap.updatedAt });
      await db.replaceAll(snap.events, snap.todos).catch(() => {});
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  pushNow: async () => {
    const { shareToken } = loadSettings();
    if (!shareToken) return { ok: false, error: '共有トークンが未設定です' };
    try {
      await syncEventsToCloud(shareToken, get().events, get().todos);
      set({ lastSyncedAt: Date.now() });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  addEvent: (input) => {
    const ev: Event = { ...input, id: uid(), createdAt: Date.now() };
    set((s) => ({ events: [...s.events, ev] }));
    void db.saveEvent(ev);
    schedulePush(get().events, get().todos);
    return ev;
  },
  addEvents: (list) => {
    const now = Date.now();
    const created: Event[] = list.map((input, i) => ({
      ...input,
      id: uid(),
      createdAt: now + i,
    }));
    set((s) => ({ events: [...s.events, ...created] }));
    void db.saveEvents(created);
    schedulePush(get().events, get().todos);
    return created;
  },
  updateEvent: (id, patch) => {
    let next: Event | null = null;
    set((s) => ({
      events: s.events.map((e) => {
        if (e.id !== id) return e;
        next = { ...e, ...patch };
        return next;
      }),
    }));
    if (next) void db.saveEvent(next);
    schedulePush(get().events, get().todos);
  },
  removeEvent: (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    void db.deleteEvent(id);
    schedulePush(get().events, get().todos);
  },
  removeGroup: (groupId) => {
    set((s) => ({ events: s.events.filter((e) => e.recurringGroupId !== groupId) }));
    void db.deleteEventsByGroup(groupId);
    schedulePush(get().events, get().todos);
  },
  addTodo: (title) => {
    const t: Todo = { id: uid(), title, done: false, createdAt: Date.now() };
    set((s) => ({ todos: [...s.todos, t] }));
    void db.saveTodo(t);
    schedulePush(get().events, get().todos);
    return t;
  },
  toggleTodo: (id) => {
    let next: Todo | null = null;
    set((s) => ({
      todos: s.todos.map((t) => {
        if (t.id !== id) return t;
        next = { ...t, done: !t.done };
        return next;
      }),
    }));
    if (next) void db.saveTodo(next);
    schedulePush(get().events, get().todos);
  },
  removeTodo: (id) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    void db.deleteTodo(id);
    schedulePush(get().events, get().todos);
  },
}));
