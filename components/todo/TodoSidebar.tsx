'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { todayStr } from '@/lib/time';
import { CalendarIcon, CloseIcon, PlusIcon } from '@/components/ui/Icon';

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

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <aside className="flex flex-col gap-4 text-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight">ToDo</h2>
        <span className="tabular text-xs text-[var(--fg-muted)]">
          残り{remaining}件
        </span>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="新しいタスク"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-[var(--fg)] px-3 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-30"
            disabled={!draft.trim()}
          >
            <PlusIcon size={14} />
            追加
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <input
            type="date"
            value={draftDeadline}
            onChange={(e) => setDraftDeadline(e.target.value)}
            className="tabular rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs"
          />
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDraftDeadline(offsetDate(p.offsetDays))}
              className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
            >
              {p.label}
            </button>
          ))}
          {draftDeadline && (
            <button
              type="button"
              onClick={() => setDraftDeadline('')}
              className="text-[11px] text-[var(--fg-subtle)] underline hover:text-[var(--fg)]"
            >
              なし
            </button>
          )}
        </div>
        <div className="text-[11px] text-[var(--fg-subtle)]">
          期限切れのタスクは自動削除されます
        </div>
      </form>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {sorted.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--border)] px-3 py-8 text-center text-xs text-[var(--fg-subtle)]">
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
                'group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--bg-soft)]',
                overdue && 'bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-500/10 dark:hover:bg-rose-500/15',
                dueToday && !overdue && 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/10 dark:hover:bg-amber-500/15',
              )}
            >
              <input
                id={`todo-${t.id}`}
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTodo(t.id)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--fg)]"
              />
              <label
                htmlFor={`todo-${t.id}`}
                className={clsx(
                  'flex-1 min-w-0 cursor-pointer leading-snug',
                  t.done && 'text-[var(--fg-subtle)] line-through',
                )}
              >
                <div className="truncate">{t.title}</div>
                {t.deadline && (
                  <div
                    className={clsx(
                      'tabular mt-0.5 flex items-center gap-1 text-[11px]',
                      t.done
                        ? 'text-[var(--fg-subtle)]'
                        : overdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : dueToday
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-[var(--fg-muted)]',
                    )}
                  >
                    <CalendarIcon size={11} />
                    <span>{t.deadline}</span>
                    <span>·</span>
                    <span>{formatDeadlineLabel(t.deadline, today)}</span>
                  </div>
                )}
              </label>
              <button
                type="button"
                onClick={() => removeTodo(t.id)}
                className="opacity-0 transition group-hover:opacity-100 text-[var(--fg-subtle)] hover:text-rose-500"
                aria-label="削除"
              >
                <CloseIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
