'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { DAY_MINUTES, formatMinutes, parseDate, timeOptions } from '@/lib/time';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">
          {d.getMonth() + 1}/{d.getDate()} ({weekday}) に追加
        </h2>

        <label className="mt-4 block text-sm">
          <span className="text-slate-600 dark:text-slate-300">タイトル</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 友達とランチ"
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">開始</span>
            <select
              value={startMin}
              onChange={(e) => setStartMin(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {times.slice(0, -1).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">終了</span>
            <select
              value={endMin}
              onChange={(e) => setEndMin(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {times.slice(1).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value === DAY_MINUTES ? formatMinutes(DAY_MINUTES - 5) + '+' : t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3">
          <div className="text-sm text-slate-600 dark:text-slate-300">カテゴリ</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('auto')}
              className={clsx(
                'rounded-full px-3 py-1 text-xs border',
                category === 'auto'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
              )}
            >
              自動 ({CATEGORY_LABELS[inferCategory(title)]})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border',
                  category === cat
                    ? CATEGORY_STYLES[cat].chip
                    : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
                )}
              >
                <span className={clsx('h-2 w-2 rounded-full', CATEGORY_STYLES[cat].swatch)} />
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={tentative}
            onChange={(e) => setTentative(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-slate-700"
          />
          <span className="text-slate-600 dark:text-slate-300">
            仮置きとして追加（破線・薄色で表示、後で確定可能）
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-slate-900"
          >
            追加
          </button>
        </div>
      </form>
    </div>
  );
}
