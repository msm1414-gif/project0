import { NextResponse } from 'next/server';
import type { Snapshot } from '@/lib/server-store';
import { sendToToken } from '@/lib/push-server';

function jstDateString(offsetDays = 0): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 9 + offsetDays * 24);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function summarize(items: { title: string }[], limit = 3): string {
  const heads = items.slice(0, limit).map((t) => t.title);
  const more = items.length > limit ? ` 他${items.length - limit}件` : '';
  return heads.join('、') + more;
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.KV_REST_API_URL) {
    return NextResponse.json({ ok: false, error: 'KV not configured' }, { status: 500 });
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ ok: false, error: 'VAPID not configured' }, { status: 500 });
  }
  try {
    const { kv } = await import('@vercel/kv');
    const today = jstDateString(0);
    const tomorrow = jstDateString(1);

    const pushKeys = await kv.keys('push:*');
    let usersNotified = 0;
    let totalSent = 0;
    let usersSkipped = 0;

    for (const pushKey of pushKeys) {
      const shareToken = pushKey.replace(/^push:/, '');
      const snap = (await kv.get<Snapshot>(`snap:${shareToken}`)) ?? null;
      if (!snap) {
        usersSkipped++;
        continue;
      }
      const todos = snap.todos ?? [];
      const dueToday = todos.filter((t) => !t.done && t.deadline === today);
      const dueTomorrow = todos.filter((t) => !t.done && t.deadline === tomorrow);
      if (dueToday.length === 0 && dueTomorrow.length === 0) continue;

      const lines: string[] = [];
      if (dueToday.length > 0) lines.push(`【今日】${summarize(dueToday)}`);
      if (dueTomorrow.length > 0) lines.push(`【明日】${summarize(dueTomorrow)}`);

      const result = await sendToToken(shareToken, {
        title: '📅 期限の近いタスク',
        body: lines.join('\n'),
        url: '/',
        tag: `reminder-${today}`,
      });
      totalSent += result.sent;
      if (result.sent > 0) usersNotified++;
    }
    return NextResponse.json({
      ok: true,
      date: today,
      tomorrow,
      pushKeys: pushKeys.length,
      usersNotified,
      usersSkipped,
      totalSent,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
