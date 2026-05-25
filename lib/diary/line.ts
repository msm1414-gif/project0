// LINE Messaging API クライアント。
// 環境変数: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET
// アクセストークンはステートレスチャネルアクセストークン方式で、
// Channel ID + Channel secret から都度発行する（15分有効）。
// 長期トークンの「発行」ボタンを探さなくて済み、より安全。
// 無料プラン: push は月200通まで、reply は無制限（設計書セクション2）。

import crypto from 'crypto';

const LINE_API = 'https://api.line.me/v2/bot/message';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v3/token';

// webhook 署名検証。rawBody は JSON.parse 前の生文字列を渡すこと。
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 発行済みトークンをメモリにキャッシュ（warm な関数インスタンス内で使い回し）。
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // 期限の1分前までは使い回す
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    throw new Error('LINE_CHANNEL_ID / LINE_CHANNEL_SECRET が未設定です');
  }
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`LINE token 発行失敗 (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// 会話中の返信（無制限枠）。
export async function replyText(replyToken: string, text: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${LINE_API}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    throw new Error(`LINE reply 失敗 (${res.status}): ${await res.text()}`);
  }
}

// Bot から口火を切る push（月200通制限あり。夜の1通のみに使う）。
export async function pushText(to: string, text: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
