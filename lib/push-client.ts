function urlBase64ToBytes(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export async function fetchPublicKey(): Promise<string> {
  const res = await fetch('/api/push/key');
  const data = (await res.json()) as { ok: boolean; publicKey?: string; error?: string };
  if (!data.ok || !data.publicKey) {
    throw new Error(data.error ?? 'VAPID 公開鍵の取得に失敗しました');
  }
  return data.publicKey;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('このブラウザは Service Worker 非対応です');
  }
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribePush(token: string): Promise<PushSubscription> {
  if (typeof window === 'undefined') throw new Error('browser only');
  if (!('Notification' in window)) throw new Error('このブラウザは通知非対応です');
  if (!('PushManager' in window)) throw new Error('このブラウザはプッシュ通知非対応です');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知が許可されませんでした');

  const publicKey = await fetchPublicKey();
  const reg = await ensureServiceWorker();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(publicKey),
    });
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      subscription: { endpoint: json.endpoint, keys: json.keys },
      userAgent: navigator.userAgent,
    }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? '購読登録に失敗しました');
  return sub;
}

export async function unsubscribePush(token: string): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, endpoint }),
  });
}

export async function sendTestPush(token: string): Promise<{ ok: boolean; error?: string; sent?: number }> {
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return (await res.json()) as { ok: boolean; error?: string; sent?: number };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua);
}
