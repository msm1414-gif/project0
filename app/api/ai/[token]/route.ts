import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/server-store';
import { generateAiMarkdown } from '@/lib/ai-export';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}(?:\.md)?$/;

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { token: raw } = await params;
  if (!raw || !TOKEN_RE.test(raw)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  const token = raw.replace(/\.md$/, '');
  const snap = await getSnapshot(token);
  const md = generateAiMarkdown({
    events: snap?.events ?? [],
    todos: snap?.todos ?? [],
    timetables: snap?.timetables ?? [],
    now: new Date(),
  });
  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Short cache so Claude sees fresh-ish data without hammering KV
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'Content-Disposition': 'inline; filename="timebox-ai.md"',
      'X-Robots-Tag': 'noindex',
    },
  });
}
