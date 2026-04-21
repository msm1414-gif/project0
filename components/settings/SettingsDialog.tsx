'use client';

import { useState } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings';
import { testNotion } from '@/lib/notion-client';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; title: string }
  | { status: 'error'; message: string };

export default function SettingsDialog({ open, onClose }: Props) {
  const initial = loadSettings();
  const [token, setToken] = useState(initial.notionToken);
  const [parentPageId, setParentPageId] = useState(initial.notionParentPageId);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  if (!open) return null;

  async function onTest() {
    if (!token || !parentPageId) return;
    setTest({ status: 'testing' });
    try {
      const res = await testNotion(token, parentPageId);
      if (res.ok) {
        setTest({ status: 'ok', title: res.title ?? '(タイトルなし)' });
      } else {
        setTest({ status: 'error', message: res.error ?? '確認に失敗しました' });
      }
    } catch (err) {
      setTest({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function onSave() {
    saveSettings({ notionToken: token.trim(), notionParentPageId: parentPageId.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">設定</h2>

        <section className="mt-4">
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
