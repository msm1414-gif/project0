import { create } from 'zustand';
import type { Event, Todo } from './types';
import * as db from './db';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface AppState {
  hydrated: boolean;
  events: Event[];
  todos: Todo[];
  hydrate: () => Promise<void>;
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
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const [events, todos] = await Promise.all([db.loadAllEvents(), db.loadAllTodos()]);
      set({ events, todos, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  addEvent: (input) => {
    const ev: Event = { ...input, id: uid(), createdAt: Date.now() };
    set((s) => ({ events: [...s.events, ev] }));
    void db.saveEvent(ev);
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
  },
  removeEvent: (id) => {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    void db.deleteEvent(id);
  },
  removeGroup: (groupId) => {
    set((s) => ({ events: s.events.filter((e) => e.recurringGroupId !== groupId) }));
    void db.deleteEventsByGroup(groupId);
  },
  addTodo: (title) => {
    const t: Todo = { id: uid(), title, done: false, createdAt: Date.now() };
    set((s) => ({ todos: [...s.todos, t] }));
    void db.saveTodo(t);
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
  },
  removeTodo: (id) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    void db.deleteTodo(id);
  },
}));
