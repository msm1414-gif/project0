import webpush from 'web-push';

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: number;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;

export function configureWebPush() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY が未設定です');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function getSubscriptions(token: string): Promise<StoredSubscription[]> {
  if (!process.env.KV_REST_API_URL) return [];
  const { kv } = await import('@vercel/kv');
  return ((await kv.get<StoredSubscription[]>(`push:${token}`)) ?? []) as StoredSubscription[];
}

export async function setSubscriptions(token: string, subs: StoredSubscription[]) {
  if (!process.env.KV_REST_API_URL) return;
  const { kv } = await import('@vercel/kv');
  if (subs.length === 0) await kv.del(`push:${token}`);
  else await kv.set(`push:${token}`, subs);
}

export async function sendToToken(
  token: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  configureWebPush();
  const subs = await getSubscriptions(token);
  if (subs.length === 0) return { sent: 0, removed: 0 };
  let sent = 0;
  const remaining: StoredSubscription[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      );
      sent++;
      remaining.push(sub);
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      // 404/410 means subscription is gone; drop it. Other errors: keep for retry next time
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        // skip
      } else {
        remaining.push(sub);
      }
    }
  }
  if (remaining.length !== subs.length) {
    await setSubscriptions(token, remaining);
  }
  return { sent, removed: subs.length - remaining.length };
}
