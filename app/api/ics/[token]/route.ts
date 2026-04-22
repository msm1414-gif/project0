import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/server-store';
import { generateICS } from '@/lib/ics';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}(?:\.ics)?$/;

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { token: raw } = await params;
  if (!raw || !TOKEN_RE.test(raw)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  const token = raw.replace(/\.ics$/, '');
  const snap = await getSnapshot(token);
  const events = snap?.events ?? [];
  const ics = generateICS(events, 'Timebox');
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, max-age=60',
      'Content-Disposition': 'inline; filename="timebox.ics"',
    },
  });
}
