import { NextResponse } from 'next/server';
import type { Event } from '@/lib/types';
import { putSnapshot } from '@/lib/server-store';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export async function POST(req: Request) {
  let body: { token?: string; events?: Event[] };
  try {
    body = (await req.json()) as { token?: string; events?: Event[] };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { token, events } = body;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  if (!Array.isArray(events)) {
    return NextResponse.json({ ok: false, error: 'events must be array' }, { status: 400 });
  }
  try {
    await putSnapshot(token, events);
    return NextResponse.json({ ok: true, count: events.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
