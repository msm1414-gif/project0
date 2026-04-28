import { NextResponse } from 'next/server';
import { getSubscriptions, setSubscriptions, type StoredSubscription } from '@/lib/push-server';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

interface Body {
  token?: string;
  subscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  userAgent?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { token, subscription, userAgent } = body;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ ok: false, error: 'invalid subscription' }, { status: 400 });
  }
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json(
      { ok: false, error: 'クラウドストレージ未設定: Vercel KV を追加してください' },
      { status: 200 },
    );
  }
  try {
    const existing = await getSubscriptions(token);
    const filtered = existing.filter((s) => s.endpoint !== subscription.endpoint);
    const stored: StoredSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      ...(userAgent ? { userAgent } : {}),
      createdAt: Date.now(),
    };
    await setSubscriptions(token, [...filtered, stored]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
