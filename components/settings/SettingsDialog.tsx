'use client';

import { useState } from 'react';
import { generateShareToken, loadSettings, saveSettings } from '@/lib/settings';
import { testNotion } from '@/lib/notion-client';
import { icsUrlFor, syncEventsToCloud } from '@/lib/sync-client';
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

function Body({ onClose }: { onClose: () => void }) {
  const initial = loadSettings();
  const [token, setToken] = useState(initial.notionToken);
  const [parentPageId, setParentPageId] = useState(initial.notionParentPageId);
  const [shareToken, setShareToken] = useState(() => {
    if (initial.shareToken) return initial.shareToken;
    const t = generateShareToken();
    saveSettings({ shareToken: t });
    return t;
  });
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [sync, setSync] = useState<SyncState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  const events = useApp((s) => s.events);

  const icsUrl = shareToken ? icsUrlFor(shareToken) : '';

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
    try {
      const count = await syncEventsToCloud(shareToken, events);
      setSync({ status: 'done', count, at: Date.now() });
    } catch (err) {
      setSync({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function onRegenerateToken() {
    if (!confirm('新しい共有トークンを発行します。既に購読中のスマホ側の URL は使えなくなり、再登録が必要です。続行しますか？'))
      return;
    const t = generateShareToken();
    setShareToken(t);
    saveSettings({ shareToken: t });
    setSync({ status: 'idle' });
  }

  async function onCopy() {
    if (!icsUrl) return;
    try {
      await navigator.clipboard.writeText(icsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function onSave() {
    saveSettings({
      notionToken: token.trim(),
      notionParentPageId: parentPageId.trim(),
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
          <h3 className="text-sm font-semibold">📲 スマホで見る (ICS 購読)</h3>
          <p className="mt-1 text-xs text-slate-500">
            クラウドに予定を同期し、スマホのカレンダーアプリ (Google / Apple) で購読できるようにします。読み取り専用です。
          </p>

          <div className="mt-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">ICS 購読 URL</div>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={icsUrl}
                className="flex-1 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={onCopy}
                disabled={!icsUrl}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {copied ? '✓ コピー' : 'コピー'}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onRegenerateToken}
                className="text-[11px] text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                トークンを再生成
              </button>
              <span className="text-[11px] text-slate-400">
                ※ この URL を知っている人は予定を閲覧できます
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onSync}
              disabled={!shareToken || sync.status === 'syncing'}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
            >
              {sync.status === 'syncing' ? '同期中...' : `今すぐ同期 (${events.length} 件)`}
            </button>
            {sync.status === 'done' && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ {sync.count} 件を同期しました
              </span>
            )}
            {sync.status === 'error' && (
              <span className="text-xs text-red-600 dark:text-red-400">✗ {sync.message}</span>
            )}
          </div>

          <details className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <summary className="cursor-pointer font-medium">スマホで購読する手順</summary>
            <div className="mt-2 space-y-2">
              <p>
                <strong>Google カレンダー (推奨):</strong> PC ブラウザで{' '}
                <a
                  href="https://calendar.google.com/calendar/r/settings/addbyurl"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline"
                >
                  Google カレンダー設定 → 「URL で追加」
                </a>{' '}
                に上の ICS URL を貼る。スマホの Google カレンダーアプリに自動で反映されます（数時間かかることあり）。
              </p>
              <p>
                <strong>Apple カレンダー (iPhone):</strong> 設定 → カレンダー → アカウント → アカウントを追加 → その他 → 照会するカレンダーを追加 → URL を貼る
              </p>
            </div>
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
