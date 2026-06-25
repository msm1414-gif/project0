'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { CalendarIcon, CheckSquareIcon, CloseIcon, PlusIcon } from '@/components/ui/Icon';

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

export default function TodoQuickAddFab() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const addTodo = useApp((s) => s.addTodo);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Hide on the dedicated ToDo page (input form already there)
  const hiddenForPath = pathname.startsWith('/todos');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addTodo(t, deadline || undefined);
    setTitle('');
    setDeadline('');
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ToDo 追加"
        title="ToDo 追加"
        className={clsx(
          'fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)] shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95 sm:hidden',
          hiddenForPath && 'pointer-events-none opacity-0',
        )}
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      >
        <div className="relative">
          <CheckSquareIcon size={20} />
          <span className="absolute -right-1.5 -bottom-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--fg)]">
            <PlusIcon size={11} strokeWidth={2.5} />
          </span>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl shadow-black/10 sm:rounded-2xl"
          >
            <div className="flex items-center gap-2">
              <CheckSquareIcon size={18} />
              <h2 className="text-lg font-semibold tracking-tight">ToDo 追加</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
                aria-label="閉じる"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-medium text-[var(--fg-muted)]">タスク</span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 課題提出"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
              />
            </label>

            <div className="mt-3">
              <span className="text-xs font-medium text-[var(--fg-muted)]">期限 (任意)</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="tabular rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs"
                />
                {PRESETS.map((p) => {
                  const v = offsetDate(p.offsetDays);
                  const active = deadline === v;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDeadline(active ? '' : v)}
                      className={clsx(
                        'rounded-md px-2 py-1.5 text-[11px] ring-1 ring-inset transition-colors',
                        active
                          ? 'bg-[var(--fg)] text-[var(--bg)] ring-[var(--fg)]'
                          : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setDeadline('')}
                    className="text-[11px] text-[var(--fg-subtle)] underline hover:text-[var(--fg)]"
                  >
                    <span className="inline-flex items-center gap-0.5">
                      <CalendarIcon size={10} />
                      クリア
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="rounded-lg bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-30"
              >
                追加
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
