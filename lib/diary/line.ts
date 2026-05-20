// LINE Messaging API クライアント。
// 環境変数: LINE_CHANNEL_SECRET（署名検証）, LINE_CHANNEL_ACCESS_TOKEN（送信）
// 無料プラン: push は月200通まで、reply は無制限（設計書セクション2）。

import crypto from 'crypto';

const LINE_API = 'https://api.line.me/v2/bot/message';

// webhook 署名検証。rawBody は JSON.parse 前の生文字列を渡すこと。
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function accessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN が未設定です');
  return token;
}

// 会話中の返信（無制限枠）。
export async function replyText(replyToken: string, text: string): Promise<void> {
  const res = await fetch(`${LINE_API}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    throw new Error(`LINE reply 失敗 (${res.status}): ${await res.text()}`);
  }
}

// Bot から口火を切る push（月200通制限あり。夜の1通のみに使う）。
export async function pushText(to: string, text: string): Promise<void> {
  const res = await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    throw new Error(`LINE push 失敗 (${res.status}): ${await res.text()}`);
  }
}

// --- webhook イベントの最小型 ---

export interface LineTextEvent {
  type: 'message';
  message: { type: 'text'; text: string };
  replyToken: string;
  source: { userId: string };
  timestamp: number;
}

export interface LineWebhookBody {
  events: Array<{
    type: string;
    message?: { type: string; text?: string };
    replyToken?: string;
    source?: { userId?: string };
    timestamp?: number;
  }>;
}

// テキストメッセージイベントだけを取り出す。
export function extractTextEvents(body: LineWebhookBody): LineTextEvent[] {
  return body.events.flatMap((e) => {
    if (
      e.type === 'message' &&
      e.message?.type === 'text' &&
      typeof e.message.text === 'string' &&
      e.replyToken &&
      e.source?.userId
    ) {
      return [
        {
          type: 'message',
          message: { type: 'text', text: e.message.text },
          replyToken: e.replyToken,
          source: { userId: e.source.userId },
          timestamp: e.timestamp ?? Date.now(),
        } satisfies LineTextEvent,
      ];
    }
    return [];
  });
}
