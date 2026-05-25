'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { DAY_MINUTES, formatMinutes, parseDate, timeOptions } from '@/lib/time';
import { SparklesIcon } from '@/components/ui/Icon';

interface Props {
  open: boolean;
  date: string;
  defaultStart?: number;
  defaultEnd?: number;
  onClose: () => void;
}

export default function QuickAddDialog({ open, date, defaultStart, defaultEnd, onClose }: Props) {
  if (!open) return null;
  return (
    <Body
      key={date}
      date={date}
      defaultStart={defaultStart}
      defaultEnd={defaultEnd}
      onClose={onClose}
    />
  );
}

function Body({
  date,
  defaultStart,
  defaultEnd,
  onClose,
}: {
  date: string;
  defaultStart?: number;
  defaultEnd?: number;
  onClose: () => void;
}) {
  const addEvent = useApp((s) => s.addEvent);
  const [title, setTitle] = useState('');
  const [startMin, setStartMin] = useState(defaultStart ?? 9 * 60);
  const [endMin, setEndMin] = useState(defaultEnd ?? 10 * 60);
  const [category, setCategory] = useState<Category | 'auto'>('auto');
  const [tentative, setTentative] = useState(true);

  const resolvedCategory: Category = category === 'auto' ? inferCategory(title) : category;
  const d = parseDate(date);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (endMin <= startMin) return;
    addEvent({
      title: title.trim() || '(無題)',
      category: resolvedCategory,
      date,
      startMinutes: startMin,
      endMinutes: Math.min(DAY_MINUTES, endMin),
      ...(tentative ? { tentative: true } : {}),
    });
    onClose();
  }

  const times = timeOptions();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl shadow-black/10 sm:rounded-2xl"
      >
        <h2 className="tabular text-lg font-semibold tracking-tight">
          {d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, '0')}.
          {String(d.getDate()).padStart(2, '0')}
          <span className="ml-2 text-sm font-normal text-[var(--fg-muted)]">({weekday}) に追加</span>
        </h2>

        <label className="mt-5 block">
          <span className="text-xs font-medium text-[var(--fg-muted)]">タイトル</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 友達とランチ"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[var(--fg-muted)]">開始</span>
            <select
              value={startMin}
              onChange={(e) => setStartMin(Number(e.target.value))}
              className="tabular mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base focus:border-[var(--border-strong)] focus:outline-none"
            >
              {times.slice(0, -1).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[var(--fg-muted)]">終了</span>
            <select
              value={endMin}
              onChange={(e) => setEndMin(Number(e.target.value))}
              className="tabular mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base focus:border-[var(--border-strong)] focus:outline-none"
            >
              {times.slice(1).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value === DAY_MINUTES ? formatMinutes(DAY_MINUTES - 5) + '+' : t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-[var(--fg-muted)]">カテゴリ</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory('auto')}
              className={clsx(
                'flex items-center gap-1 rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                category === 'auto'
                  ? 'bg-[var(--fg)] text-[var(--bg)] ring-[var(--fg)]'
                  : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
              )}
            >
              <SparklesIcon size={11} />
              自動 ({CATEGORY_LABELS[inferCategory(title)]})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                  category === cat
                    ? CATEGORY_STYLES[cat].chip
                    : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
                )}
              >
                <span className={clsx('h-2 w-2 rounded-full', CATEGORY_STYLES[cat].swatch)} />
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={tentative}
            onChange={(e) => setTentative(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--fg)]"
          />
          <span className="text-[var(--fg-muted)]">
            仮置きとして追加（破線・薄色で表示、後で確定可能）
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90"
          >
            追加
          </button>
        </div>
      </form>
    </div>
  );
}
