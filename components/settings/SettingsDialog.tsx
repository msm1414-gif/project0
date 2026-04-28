'use client';

import { useEffect, useState } from 'react';
import { generateShareToken, loadSettings, saveSettings } from '@/lib/settings';
import { testNotion } from '@/lib/notion-client';
import { icsUrlFor, shareUrlFor } from '@/lib/sync-client';
import {
  getCurrentSubscription,
  isIOS,
  isStandalone,
  sendTestPush,
  subscribePush,
  unsubscribePush,
} from '@/lib/push-client';
import { useApp } from '@/lib/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; title: string }
  | { status: 'error'; message: string };

type SyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'done'; count: number; at: number }
  | { status: 'error'; message: string };

type PullState =
  | { status: 'idle' }
  | { status: 'pulling' }
  | { status: 'done'; at: number; empty: boolean }
  | { status: 'error'; message: string };

type PushState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'enabled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

function getInitialPushStatus(): 'idle' | 'enabled' | 'denied' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'idle';
  if (Notification.permission === 'denied') return 'denied';
  return 'idle';
}

function Body({ onClose }: { onClose: () => void }) {
  const initial = loadSettings();
  const [token, setToken] = useState(initial.notionToken);
  const [parentPageId, setParentPageId] = useState(initial.notionParentPageId);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initial.anthropicApiKey);
  const [shareToken, setShareToken] = useState(() => {
    if (initial.shareToken) return initial.shareToken;
    const t = generateShareToken();
    saveSettings({ shareToken: t });
    return t;
  });
  const [pushState, setPushState] = useState<PushState>({ status: getInitialPushStatus() });
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const ios = isIOS();
  const standalone = isStandalone();
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [sync, setSync] = useState<SyncState>({ status: 'idle' });
  const [pull, setPull] = useState<PullState>({ status: 'idle' });
  const [copiedIcs, setCopiedIcs] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const events = useApp((s) => s.events);
  const pushNow = useApp((s) => s.pushNow);
  const pullNow = useApp((s) => s.pullNow);
  const lastSyncedAt = useApp((s) => s.lastSyncedAt);

  const icsUrl = shareToken ? icsUrlFor(shareToken) : '';
  const shareUrl = shareToken ? shareUrlFor(shareToken) : '';

  async function onTest() {
    if (!token || !parentPageId) return;
    setTest({ status: 'testing' });
    try {
      const res = await testNotion(token, parentPageId);
      if (res.ok) setTest({ status: 'ok', title: res.title ?? '(タイトルなし)' });
      else setTest({ status: 'error', message: res.error ?? '確認に失敗しました' });
    } catch (err) {
      setTest({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function onSync() {
    if (!shareToken) return;
    setSync({ status: 'syncing' });
    const res = await pushNow();
    if (res.ok) {
      setSync({ status: 'done', count: events.length, at: Date.now() });
    } else {
      setSync({ status: 'error', message: res.error ?? '同期に失敗しました' });
    }
  }

  async function onPull() {
    if (!shareToken) return;
    setPull({ status: 'pulling' });
    const res = await pullNow();
    if (res.ok) {
      setPull({ status: 'done', at: Date.now(), empty: !!res.empty });
    } else {
      setPull({ status: 'error', message: res.error ?? '取得に失敗しました' });
    }
  }

  function onRegenerateToken() {
    if (!confirm('新しい共有トークンを発行します。既に購読中のスマホ側の URL は使えなくなり、再登録が必要です。続行しますか？'))
      return;
    const t = generateShareToken();
    setShareToken(t);
    saveSettings({ shareToken: t });
    setSync({ status: 'idle' });
    setPull({ status: 'idle' });
  }

  async function onCopy(target: 'ics' | 'share') {
    const text = target === 'ics' ? icsUrl : shareUrl;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (target === 'ics') {
        setCopiedIcs(true);
        setTimeout(() => setCopiedIcs(false), 1500);
      } else {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 1500);
      }
    } catch {
      /* ignore */
    }
  }

  async function onEnableNotifications() {
    if (!shareToken) return;
    setPushState({ status: 'busy' });
    setPushMessage(null);
    try {
      await subscribePush(shareToken);
      setPushState({ status: 'enabled' });
      setPushMessage('通知を有効にしました。');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (typeof window !== 'undefined' && Notification.permission === 'denied') {
        setPushState({ status: 'denied' });
      } else {
        setPushState({ status: 'error', message: msg });
      }
    }
  }

  async function onDisableNotifications() {
    if (!shareToken) return;
    setPushState({ status: 'busy' });
    setPushMessage(null);
    try {
      await unsubscribePush(shareToken);
      setPushState({ status: 'idle' });
      setPushMessage('通知を解除しました。');
    } catch (err) {
      setPushState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function onTestPush() {
    if (!shareToken) return;
    setPushMessage(null);
    const res = await sendTestPush(shareToken);
    if (res.ok) {
      setPushMessage(`テスト通知を ${res.sent ?? 0} 端末に送信しました`);
    } else {
      setPushMessage(`テスト失敗: ${res.error}`);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    let cancelled = false;
    void getCurrentSubscription().then((sub) => {
      if (!cancelled && sub) setPushState({ status: 'enabled' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onSave() {
    saveSettings({
      notionToken: token.trim(),
      notionParentPageId: parentPageId.trim(),
      anthropicApiKey: anthropicApiKey.trim(),
      shareToken: shareToken.trim(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">設定</h2>

        <section className="mt-4">
          <h3 className="text-sm font-semibold">📱 スマホと双方向同期</h3>
          <p className="mt-1 text-xs text-slate-500">
            下の「スマホ用 URL」をスマホのブラウザで開くと、同じデータに接続して編集もできます。PC・スマホの両方で編集した内容は自動的にクラウド経由で同期されます（1〜2 秒のディレイあり）。
          </p>

          <div className="mt-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">スマホ用 URL</div>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => onCopy('share')}
                disabled={!shareUrl}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {copiedShare ? '✓ コピー' : 'コピー'}
              </button>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              スマホのブラウザで開くと自動的に設定 → クラウド側のデータを取得します
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSync}
              disabled={!shareToken || sync.status === 'syncing'}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
            >
              {sync.status === 'syncing' ? '同期中...' : `↑ 手動でpush (${events.length} 件)`}
            </button>
            <button
              type="button"
              onClick={onPull}
              disabled={!shareToken || pull.status === 'pulling'}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {pull.status === 'pulling' ? '取得中...' : '↓ クラウドから再取得'}
            </button>
            {lastSyncedAt && (
              <span className="text-[11px] text-slate-500">
                最終取得: {new Date(lastSyncedAt).toLocaleString('ja-JP')}
              </span>
            )}
          </div>

          {sync.status === 'done' && (
            <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              ✓ クラウドに push しました
            </div>
          )}
          {sync.status === 'error' && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">✗ push 失敗: {sync.message}</div>
          )}
          {pull.status === 'done' && (
            <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              ✓ クラウドから取得しました{pull.empty && '（クラウドは空でした）'}
            </div>
          )}
          {pull.status === 'error' && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">✗ 取得失敗: {pull.message}</div>
          )}

          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-300">ICS 購読 URL（読み取り専用・Google/Apple カレンダー用）</div>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={icsUrl}
                className="flex-1 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => onCopy('ics')}
                disabled={!icsUrl}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {copiedIcs ? '✓ コピー' : 'コピー'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onRegenerateToken}
              className="text-[11px] text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              トークンを再生成
            </button>
            <span className="text-[11px] text-slate-400">
              ※ URL を知っている人は予定の閲覧・編集が可能です
            </span>
          </div>
        </section>

        <section className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold">🔔 期限通知 (毎朝 8:00)</h3>
          <p className="mt-1 text-xs text-slate-500">
            その日が期限の ToDo と、翌日が期限の ToDo を毎朝 8:00 (JST) にプッシュ通知で知らせます。
          </p>

          {ios && !standalone && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              ⚠️ iPhone/iPad では通知を受け取るために <strong>このページをホーム画面に追加</strong> してから開く必要があります。
              <br />
              共有ボタン → 「ホーム画面に追加」→ ホーム画面のアイコンから開いて再度ここを開いてください。
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pushState.status === 'enabled' ? (
              <>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                  ✓ 通知有効
                </span>
                <button
                  type="button"
                  onClick={onTestPush}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  テスト通知を送る
                </button>
                <button
                  type="button"
                  onClick={onDisableNotifications}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  通知を解除
                </button>
              </>
            ) : pushState.status === 'denied' ? (
              <div className="text-xs text-red-600 dark:text-red-400">
                ✗ 通知がブロックされています。ブラウザ設定からこのサイトの通知を「許可」に変更してください。
              </div>
            ) : (
              <button
                type="button"
                onClick={onEnableNotifications}
                disabled={pushState.status === 'busy'}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                {pushState.status === 'busy' ? '処理中...' : '🔔 通知を有効にする'}
              </button>
            )}
          </div>
          {pushMessage && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">{pushMessage}</div>
          )}
          {pushState.status === 'error' && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">✗ {pushState.message}</div>
          )}
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer">仕組みと前提</summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Vercel KV と VAPID キーが設定されている必要があります（README または管理者に確認）</li>
              <li>iPhone はホーム画面に追加した PWA としてのみ通知受信可能 (iOS 16.4+)</li>
              <li>Android Chrome / Firefox / Edge は通常のブラウザでも OK</li>
              <li>各端末で個別に「通知を有効にする」を押す必要あり</li>
            </ul>
          </details>
        </section>

        <section className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold">Notion 連携</h3>
          <p className="mt-1 text-xs text-slate-500">
            講義ノートを自動で Notion に作成します。トークンはブラウザにのみ保存され、API 呼び出し時だけ送信されます。
          </p>

          <label className="mt-3 block text-sm">
            <span className="text-slate-600 dark:text-slate-300">Integration Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ntn_..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <label className="mt-3 block text-sm">
            <span className="text-slate-600 dark:text-slate-300">親ページ ID</span>
            <input
              type="text"
              value={parentPageId}
              onChange={(e) => setParentPageId(e.target.value)}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Notion ページ URL 末尾の 32 文字（ハイフンあり・なしどちらでも OK）
            </span>
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onTest}
              disabled={!token || !parentPageId || test.status === 'testing'}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {test.status === 'testing' ? '確認中...' : '接続テスト'}
            </button>
            {test.status === 'ok' && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ 接続成功: {test.title}
              </span>
            )}
            {test.status === 'error' && (
              <span className="text-xs text-red-600 dark:text-red-400">✗ {test.message}</span>
            )}
          </div>

          <details className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <summary className="cursor-pointer font-medium">セットアップ手順</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline"
                >
                  notion.so/my-integrations
                </a>{' '}
                で「+ New integration」
              </li>
              <li>Secret (ntn_...) をコピー → 上の Token 欄に貼る</li>
              <li>Notion で親ページ（例: 「授業ノート」）を作る</li>
              <li>親ページ右上の「…」→ Connections → 作成した integration を追加</li>
              <li>親ページ URL 末尾の 32 文字をコピー → 上の 親ページ ID 欄に貼る</li>
              <li>「接続テスト」で緑色のチェックが出れば保存</li>
            </ol>
          </details>
        </section>

        <section className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold">📷 時間割スクショ取り込み (Anthropic API)</h3>
          <p className="mt-1 text-xs text-slate-500">
            UTOL のスクショを Claude が読み取って科目を自動登録します。API キーはブラウザにのみ保存され、画像解析時にだけサーバー経由で送信されます。
          </p>

          <label className="mt-3 block text-sm">
            <span className="text-slate-600 dark:text-slate-300">Anthropic API Key</span>
            <input
              type="password"
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <details className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <summary className="cursor-pointer font-medium">API キー取得手順</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline"
                >
                  console.anthropic.com
                </a>{' '}
                でアカウント作成（Google ログイン可）
              </li>
              <li>新規登録で $5 分の無料クレジットが付与されます</li>
              <li>左メニュー「API keys」→「Create Key」→ コピー（`sk-ant-...`）</li>
              <li>上の Anthropic API Key 欄に貼る → 保存</li>
              <li>1 枚あたり ~$0.01 程度なので無料枠で 500 枚以上解析可能</li>
            </ol>
          </details>
        </section>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-slate-900"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsDialog({ open, onClose }: Props) {
  if (!open) return null;
  return <Body onClose={onClose} />;
}
