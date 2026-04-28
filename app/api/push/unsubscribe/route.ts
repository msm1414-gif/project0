import { NextResponse } from 'next/server';
import { getSubscriptions, setSubscriptions } from '@/lib/push-server';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

interface Body {
  token?: string;
  endpoint?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { token, endpoint } = body;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ ok: false, error: 'invalid endpoint' }, { status: 400 });
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ ok: true });
  }
  try {
    const subs = await getSubscriptions(token);
    const remaining = subs.filter((s) => s.endpoint !== endpoint);
    await setSubscriptions(token, remaining);
    return NextResponse.json({ ok: true, removed: subs.length - remaining.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
