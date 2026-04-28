import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'VAPID_PUBLIC_KEY が未設定です' },
      { status: 200 },
    );
  }
  return NextResponse.json({ ok: true, publicKey: key });
}
