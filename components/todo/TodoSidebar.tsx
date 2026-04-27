'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { todayStr } from '@/lib/time';

const PRESETS: { label: string; offsetDays: number }[] = [
  { label: '今日', offsetDays: 0 },
  { label: '明日', offsetDays: 1 },
  { label: '+3日', offsetDays: 3 },
  { label: '+1週', offsetDays: 7 },
];

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDeadlineLabel(deadline: string, today: string): string {
  if (deadline === today) return '今日まで';
  const d = new Date(deadline);
  const t = new Date(today);
  const diffMs = d.getTime() - t.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return '明日まで';
  if (diffDays > 1) return `あと${diffDays}日`;
  if (diffDays === -1) return '昨日が期限';
  return `${-diffDays}日超過`;
}

export default function TodoSidebar() {
  const todos = useApp((s) => s.todos);
  const addTodo = useApp((s) => s.addTodo);
  const toggleTodo = useApp((s) => s.toggleTodo);
  const removeTodo = useApp((s) => s.removeTodo);
  const [draft, setDraft] = useState('');
  const [draftDeadline, setDraftDeadline] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    addTodo(t, draftDeadline || undefined);
    setDraft('');
    setDraftDeadline('');
  }

  const today = todayStr();
  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <aside className="flex flex-col gap-3 text-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">ToDo</h2>
        <span className="text-xs text-slate-500">{todos.filter((t) => !t.done).length} 件未完了</span>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="新しいタスク"
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
            disabled={!draft.trim()}
          >
            追加
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-slate-500">期限:</span>
          <input
            type="date"
            value={draftDeadline}
            onChange={(e) => setDraftDeadline(e.target.value)}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDraftDeadline(offsetDate(p.offsetDays))}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              {p.label}
            </button>
          ))}
          {draftDeadline && (
            <button
              type="button"
              onClick={() => setDraftDeadline('')}
              className="text-[11px] text-slate-400 underline hover:text-slate-700"
            >
              なし
            </button>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          ※ 期限を過ぎた未完了タスクはアプリを開いた時に自動削除されます
        </div>
      </form>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {sorted.length === 0 && (
          <li className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
            タスクはまだありません
          </li>
        )}
        {sorted.map((t) => {
          const overdue = !!t.deadline && !t.done && t.deadline < today;
          const dueToday = t.deadline === today && !t.done;
          return (
            <li
              key={t.id}
              className={clsx(
                'group flex items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800',
                overdue && 'bg-red-50 dark:bg-red-950/30',
                dueToday && 'bg-amber-50 dark:bg-amber-950/30',
              )}
            >
              <input
                id={`todo-${t.id}`}
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTodo(t.id)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-slate-700"
              />
              <label
                htmlFor={`todo-${t.id}`}
                className={clsx('flex-1 cursor-pointer min-w-0', t.done && 'text-slate-400 line-through')}
              >
                <div className="truncate">{t.title}</div>
                {t.deadline && (
                  <div
                    className={clsx(
                      'text-[11px]',
                      t.done
                        ? 'text-slate-400'
                        : overdue
                          ? 'text-red-600 dark:text-red-400'
                          : dueToday
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-500',
                    )}
                  >
                    📅 {t.deadline} ({formatDeadlineLabel(t.deadline, today)})
                  </div>
                )}
              </label>
              <button
                type="button"
                onClick={() => removeTodo(t.id)}
                className="opacity-0 transition group-hover:opacity-100 text-xs text-slate-400 hover:text-red-500"
                aria-label="削除"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
