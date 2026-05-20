import { NextResponse } from 'next/server';
import { ensureUser, getRecentMessages, insertMessage } from '@/lib/diary/db';
import { generateSessionReply } from '@/lib/diary/conversation';
import {
  extractTextEvents,
  replyText,
  verifySignature,
  type LineWebhookBody,
} from '@/lib/diary/line';
import type { DiaryMessage } from '@/lib/diary/types';

// 夜のセッションが「開いている」とみなす猶予（最後の bot セッション発言からの経過）。
const SESSION_WINDOW_MS = 3 * 60 * 60 * 1000;

// 直近の bot セッション発言が SESSION_WINDOW_MS 以内なら会話セッション中。
function isSessionActive(recent: DiaryMessage[]): boolean {
  const lastBotSession = [...recent]
    .reverse()
    .find((m) => m.sender === 'bot' && m.context === 'session');
  if (!lastBotSession) return false;
  return Date.now() - new Date(lastBotSession.createdAt).getTime() < SESSION_WINDOW_MS;
}

// 現在のセッションに属するメッセージだけを切り出す（直近の session 連続ぶん）。
function currentSessionMessages(recent: DiaryMessage[]): DiaryMessage[] {
  const out: DiaryMessage[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].context !== 'session') break;
    out.unshift(recent[i]);
  }
  return out;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-line-signature'))) {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(raw) as LineWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const events = extractTextEvents(body);
  for (const ev of events) {
    try {
      const user = await ensureUser(ev.source.userId);
      if (!user) continue; // allowlist 外のユーザーは無視

      const recent = await getRecentMessages(user.id, 40);
      const inSession = isSessionActive(recent);
      const context = inSession ? 'session' : 'daytime';

      await insertMessage(user.id, 'user', ev.message.text, context);

      if (!inSession) {
        // 日中メッセージ: 即レスせず静かに保存（設計書セクション3）。夜にまとめて触れる。
        continue;
      }

      // セッション中: 直前の発言に反応して次を一つ聞く。
      const session = [
        ...currentSessionMessages(recent),
        {
          id: 'pending',
          userId: user.id,
          sender: 'user' as const,
          body: ev.message.text,
          context: 'session' as const,
          createdAt: new Date().toISOString(),
        },
      ];
      const reply = await generateSessionReply(user, session);
      await insertMessage(user.id, 'bot', reply, 'session');
      await replyText(ev.replyToken, reply);
    } catch (err) {
      // 1イベントの失敗で webhook 全体を 500 にしない（LINE の再送ループを避ける）。
      console.error('[line/webhook] event handling failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
