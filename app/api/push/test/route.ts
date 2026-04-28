import { NextResponse } from 'next/server';
import { sendToToken } from '@/lib/push-server';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { token } = body;
  if (!token || !TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 400 });
  }
  try {
    const result = await sendToToken(token, {
      title: '🔔 テスト通知',
      body: 'Timebox からの通知が届いています。設定は正常です。',
      url: '/',
      tag: 'timebox-test',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
