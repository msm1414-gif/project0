import { NextResponse } from 'next/server';
import { getRecentMessages, insertMessage, listUsers } from '@/lib/diary/db';
import { generateOpeningMessage } from '@/lib/diary/conversation';
import { pushText } from '@/lib/diary/line';

// 全ユーザー分の AI 生成を順に回すので既定の10秒で足りない。
export const maxDuration = 60;

// 現在の JST 時刻（0-23）。
function jstHour(): number {
  const d = new Date();
  return (d.getUTCHours() + 9) % 24;
}

// 夜、Bot から会話の口火を切る（push 1通）。
// Vercel Cron は無料プランだと1日1回・固定時刻でしか走れないため、
// 「Cron が走った時刻＝配信時刻」とみなし、全ユーザーに送る。
// 配信時刻を変えたいときは vercel.json の schedule（UTC）だけを変える。
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const hour = jstHour();
  let pushed = 0;
  const errors: string[] = [];

  try {
    const users = await listUsers();
    for (const user of users) {
      try {
        const recent = await getRecentMessages(user.id, 40);
        const opening = await generateOpeningMessage(user, recent);
        // bot の口火は session コンテキストで保存 → 以降の返信がセッション扱いになる。
        await insertMessage(user.id, 'bot', opening, 'session');
        await pushText(user.lineUserId, opening);
        pushed++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, hour, pushed, errors });
}
