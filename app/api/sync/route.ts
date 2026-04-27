import { NextResponse } from 'next/server';
import type { Event, Timetable, Todo } from '@/lib/types';
import { getSnapshot, putSnapshot } from '@/lib/server-store';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export async function POST(req: Request) {
  let body: { token?: string; events?: Event[]; todos?: Todo[]; timetables?: Timetable[] };
  try {
    body = (await req.json()) as {
      token?: string;
      events?: Event[];
      todos?: Todo[];
      timetables?: Timetable[];
    };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { token, events, todos, timetables } = body;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  if (!Array.isArray(events) || !Array.isArray(todos)) {
    return NextResponse.json({ ok: false, error: 'events / todos must be arrays' }, { status: 400 });
  }
  try {
    const snap = await putSnapshot(token, events, todos, timetables ?? []);
    return NextResponse.json({ ok: true, updatedAt: snap.updatedAt, count: events.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  try {
    const snap = await getSnapshot(token);
    if (!snap) {
      return NextResponse.json({
        ok: true,
        empty: true,
        events: [],
        todos: [],
        timetables: [],
        updatedAt: 0,
      });
    }
    return NextResponse.json({
      ok: true,
      empty: false,
      events: snap.events,
      todos: snap.todos,
      timetables: snap.timetables,
      updatedAt: snap.updatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
