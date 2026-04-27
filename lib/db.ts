import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Event, Timetable, Todo } from './types';

interface AppDB extends DBSchema {
  events: {
    key: string;
    value: Event;
    indexes: { 'by-date': string; 'by-group': string; 'by-timetable': string };
  };
  todos: {
    key: string;
    value: Todo;
  };
  timetables: {
    key: string;
    value: Timetable;
  };
}

const DB_NAME = 'timebox-app';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in the browser'));
  }
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('events')) {
          const store = db.createObjectStore('events', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
          store.createIndex('by-group', 'recurringGroupId');
          store.createIndex('by-timetable', 'timetableId');
        } else if (oldVersion < 2) {
          const store = transaction.objectStore('events');
          if (!store.indexNames.contains('by-timetable')) {
            store.createIndex('by-timetable', 'timetableId');
          }
        }
        if (!db.objectStoreNames.contains('todos')) {
          db.createObjectStore('todos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('timetables')) {
          db.createObjectStore('timetables', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadAllEvents(): Promise<Event[]> {
  const db = await getDB();
  return db.getAll('events');
}

export async function saveEvent(ev: Event): Promise<void> {
  const db = await getDB();
  await db.put('events', ev);
}

export async function saveEvents(list: Event[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('events', 'readwrite');
  await Promise.all(list.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('events', id);
}

export async function deleteEventsByGroup(groupId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('events', 'readwrite');
  const idx = tx.store.index('by-group');
  let cursor = await idx.openCursor(IDBKeyRange.only(groupId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function loadAllTodos(): Promise<Todo[]> {
  const db = await getDB();
  return db.getAll('todos');
}

export async function saveTodo(t: Todo): Promise<void> {
  const db = await getDB();
  await db.put('todos', t);
}

export async function saveTodos(list: Todo[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('todos', 'readwrite');
  await Promise.all(list.map((t) => tx.store.put(t)));
  await tx.done;
}

export async function deleteTodo(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('todos', id);
}

export async function replaceAll(
  events: Event[],
  todos: Todo[],
  timetables: Timetable[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['events', 'todos', 'timetables'], 'readwrite');
  await tx.objectStore('events').clear();
  await tx.objectStore('todos').clear();
  await tx.objectStore('timetables').clear();
  await Promise.all(events.map((e) => tx.objectStore('events').put(e)));
  await Promise.all(todos.map((t) => tx.objectStore('todos').put(t)));
  await Promise.all(timetables.map((t) => tx.objectStore('timetables').put(t)));
  await tx.done;
}

export async function loadAllTimetables(): Promise<Timetable[]> {
  const db = await getDB();
  return db.getAll('timetables');
}

export async function saveTimetable(t: Timetable): Promise<void> {
  const db = await getDB();
  await db.put('timetables', t);
}

export async function deleteTimetable(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('timetables', id);
}
