import { create } from 'zustand';
import { eachDayOfInterval } from 'date-fns';
import type { Event, Timetable, Todo } from './types';
import * as db from './db';
import { loadSettings } from './settings';
import { pullFromCloud, syncEventsToCloud } from './sync-client';
import { isJapaneseHoliday } from './holidays';
import { fallSemester, PERIOD_TIMES, springSemester } from './semesters';
import { formatDate, parseDate, todayStr } from './time';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pruneExpiredTodos(todos: Todo[]): { kept: Todo[]; expiredIds: string[] } {
  const today = todayStr();
  const kept: Todo[] = [];
  const expiredIds: string[] = [];
  for (const t of todos) {
    if (t.deadline && !t.done && t.deadline < today) expiredIds.push(t.id);
    else kept.push(t);
  }
  return { kept, expiredIds };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePush(events: Event[], todos: Todo[], timetables: Timetable[]) {
  if (typeof window === 'undefined') return;
  const { shareToken } = loadSettings();
  if (!shareToken) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncEventsToCloud(shareToken, events, todos, timetables).catch(() => {});
  }, 1500);
}

export interface RegenerateResult {
  removed: number;
  created: number;
  preservedNotion: number;
}

interface AppState {
  hydrated: boolean;
  events: Event[];
  todos: Todo[];
  timetables: Timetable[];
  lastSyncedAt: number | null;
  hydrate: () => Promise<void>;
  pullNow: () => Promise<{ ok: boolean; empty?: boolean; error?: string }>;
  pushNow: () => Promise<{ ok: boolean; error?: string }>;
  addEvent: (input: Omit<Event, 'id' | 'createdAt'>) => Event;
  addEvents: (list: Omit<Event, 'id' | 'createdAt'>[]) => Event[];
  updateEvent: (id: string, patch: Partial<Omit<Event, 'id' | 'createdAt'>>) => void;
  removeEvent: (id: string) => void;
  removeGroup: (groupId: string) => void;
  addTodo: (title: string, deadline?: string) => Todo;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  saveTimetable: (t: Timetable) => void;
  removeTimetable: (id: string) => void;
  applyTimetable: (timetable: Timetable) => RegenerateResult;
  removeTimetableEvents: (timetableId: string) => number;
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  events: [],
  todos: [],
  timetables: [],
  lastSyncedAt: null,
  hydrate: async () => {
    if (get().hydrated) return;
    let events: Event[] = [];
    let todos: Todo[] = [];
    let timetables: Timetable[] = [];
    try {
      [events, todos, timetables] = await Promise.all([
        db.loadAllEvents(),
        db.loadAllTodos(),
        db.loadAllTimetables(),
      ]);
    } catch {
      /* first run */
    }
    {
      const { kept, expiredIds } = pruneExpiredTodos(todos);
      if (expiredIds.length > 0) {
        for (const id of expiredIds) void db.deleteTodo(id);
        todos = kept;
      }
    }
    set({ events, todos, timetables, hydrated: true });
    const { shareToken } = loadSettings();
    if (shareToken) {
      try {
        const snap = await pullFromCloud(shareToken);
        if (!snap.empty) {
          const { kept, expiredIds } = pruneExpiredTodos(snap.todos);
          set({
            events: snap.events,
            todos: kept,
            timetables: snap.timetables,
            lastSyncedAt: snap.updatedAt,
          });
          await db.replaceAll(snap.events, kept, snap.timetables).catch(() => {});
          if (expiredIds.length > 0) {
            void syncEventsToCloud(shareToken, snap.events, kept, snap.timetables).catch(() => {});
          }
        } else {
          void syncEventsToCloud(shareToken, events, todos, timetables).catch(() => {});
        }
      } catch {
        /* offline */
      }
    }
  },
  pullNow: async () => {
    const { shareToken } = loadSettings();
    if (!shareToken) return { ok: false, error: '共有トークンが未設定です' };
    try {
      const snap = await pullFromCloud(shareToken);
      if (snap.empty) return { ok: true, empty: true };
      const { kept, expiredIds } = pruneExpiredTodos(snap.todos);
      set({
        events: snap.events,
        todos: kept,
        timetables: snap.timetables,
        lastSyncedAt: snap.updatedAt,
      });
      await db.replaceAll(snap.events, kept, snap.timetables).catch(() => {});
      if (expiredIds.length > 0) {
        void syncEventsToCloud(shareToken, snap.events, kept, snap.timetables).catch(() => {});
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
  pushNow: async () => {
    const { shareToken } = loadSettings();
    if (!shareToken) return { ok: false, error: '共有トークンが未設定です' };
    try {
      await syncEventsToCloud(shareToken, get().events, get().todos, get().timetables);
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
    schedulePush(get().events, get().todos, get().timetables);
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
    schedulePush(get().events, get().todos, get().timetables);
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
    schedulePush(get().events, get().todos, get().timetables);
  },
  removeEvent: (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    void db.deleteEvent(id);
    schedulePush(get().events, get().todos, get().timetables);
  },
  removeGroup: (groupId) => {
    set((s) => ({ events: s.events.filter((e) => e.recurringGroupId !== groupId) }));
    void db.deleteEventsByGroup(groupId);
    schedulePush(get().events, get().todos, get().timetables);
  },
  addTodo: (title, deadline) => {
    const t: Todo = {
      id: uid(),
      title,
      done: false,
      ...(deadline ? { deadline } : {}),
      createdAt: Date.now(),
    };
    set((s) => ({ todos: [...s.todos, t] }));
    void db.saveTodo(t);
    schedulePush(get().events, get().todos, get().timetables);
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
    schedulePush(get().events, get().todos, get().timetables);
  },
  removeTodo: (id) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    void db.deleteTodo(id);
    schedulePush(get().events, get().todos, get().timetables);
  },
  saveTimetable: (t) => {
    set((s) => {
      const exists = s.timetables.some((x) => x.id === t.id);
      const next = exists
        ? s.timetables.map((x) => (x.id === t.id ? t : x))
        : [...s.timetables, t];
      return { timetables: next };
    });
    void db.saveTimetable(t);
    schedulePush(get().events, get().todos, get().timetables);
  },
  removeTimetable: (id) => {
    set((s) => ({ timetables: s.timetables.filter((t) => t.id !== id) }));
    void db.deleteTimetable(id);
    schedulePush(get().events, get().todos, get().timetables);
  },
  removeTimetableEvents: (timetableId) => {
    const before = get().events.length;
    const removed = get().events.filter((e) => e.timetableId === timetableId);
    set((s) => ({ events: s.events.filter((e) => e.timetableId !== timetableId) }));
    for (const e of removed) void db.deleteEvent(e.id);
    schedulePush(get().events, get().todos, get().timetables);
    return before - get().events.length;
  },
  applyTimetable: (timetable) => {
    const oldEvents = get().events.filter((e) => e.timetableId === timetable.id);
    const notionMap = new Map<string, { url: string; id: string }>();
    for (const ev of oldEvents) {
      if (ev.notionPageUrl && ev.notionPageId) {
        notionMap.set(`${ev.date}__${ev.title}`, { url: ev.notionPageUrl, id: ev.notionPageId });
      }
    }

    const semester =
      timetable.semesterKey === 'spring'
        ? springSemester(timetable.year)
        : fallSemester(timetable.year);

    let preservedNotion = 0;
    const newEvents: Event[] = [];
    const now = Date.now();
    let counter = 0;
    for (const cell of timetable.cells) {
      if (!cell.subject.trim()) continue;
      const period = PERIOD_TIMES.find((p) => p.period === cell.period);
      if (!period) continue;
      for (const range of semester.ranges) {
        const days = eachDayOfInterval({
          start: parseDate(range.start),
          end: parseDate(range.end),
        });
        for (const d of days) {
          if (d.getDay() !== cell.day) continue;
          if (timetable.excludeHolidays && isJapaneseHoliday(d)) continue;
          const date = formatDate(d);
          const key = `${date}__${cell.subject.trim()}`;
          const preserved = notionMap.get(key);
          const ev: Event = {
            id: uid(),
            title: cell.subject.trim(),
            category: 'university',
            date,
            startMinutes: period.start,
            endMinutes: period.end,
            recurringGroupId: `tt-${timetable.id}`,
            timetableId: timetable.id,
            createdAt: now + counter++,
            ...(preserved && { notionPageUrl: preserved.url, notionPageId: preserved.id }),
          };
          if (preserved) preservedNotion++;
          newEvents.push(ev);
        }
      }
    }

    const oldIds = new Set(oldEvents.map((e) => e.id));
    set((s) => ({
      events: [...s.events.filter((e) => !oldIds.has(e.id)), ...newEvents],
    }));
    for (const e of oldEvents) void db.deleteEvent(e.id);
    void db.saveEvents(newEvents);
    schedulePush(get().events, get().todos, get().timetables);

    return {
      removed: oldEvents.length,
      created: newEvents.length,
      preservedNotion,
    };
  },
}));
