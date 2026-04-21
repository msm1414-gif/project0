'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { eachDayOfInterval } from 'date-fns';
import type { Category } from '@/lib/types';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { DAY_MINUTES, formatDate, parseDate, timeOptions, todayStr } from '@/lib/time';
import { useApp } from '@/lib/store';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BulkRegisterDialog({ open, onClose }: Props) {
  const addEvents = useApp((s) => s.addEvents);
  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [startMin, setStartMin] = useState(9 * 60);
  const [endMin, setEndMin] = useState(10 * 60 + 30);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | 'auto'>('auto');

  const resolvedCategory: Category = category === 'auto' ? inferCategory(title) : category;

  const preview = useMemo(() => {
    if (!startDate || !endDate) return { count: 0, firstDates: [] as string[] };
    const sd = parseDate(startDate);
    const ed = parseDate(endDate);
    if (sd > ed) return { count: 0, firstDates: [] };
    const list = eachDayOfInterval({ start: sd, end: ed }).filter((d) => days[d.getDay()]);
    return {
      count: list.length,
      firstDates: list.slice(0, 3).map((d) => formatDate(d)),
    };
  }, [startDate, endDate, days]);

  if (!open) return null;

  function toggleDay(i: number) {
    setDays((prev) => prev.map((v, j) => (j === i ? !v : v)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (endMin <= startMin) return;
    const sd = parseDate(startDate);
    const ed = parseDate(endDate);
    if (sd > ed) return;
    const dates = eachDayOfInterval({ start: sd, end: ed }).filter((d) => days[d.getDay()]);
    if (dates.length === 0) return;
    const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addEvents(
      dates.map((d) => ({
        title: title.trim() || '(無題)',
        category: resolvedCategory,
        date: formatDate(d),
        startMinutes: startMin,
        endMinutes: Math.min(DAY_MINUTES, endMin),
        recurringGroupId: groupId,
      })),
    );
    onClose();
  }

  const times = timeOptions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">期間指定で一括登録</h2>
        <p className="mt-1 text-xs text-slate-500">
          期間内の指定曜日に同じ予定をまとめて作成します。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">開始日</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">終了日</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>

        <div className="mt-3">
          <div className="text-sm text-slate-600 dark:text-slate-300">曜日</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleDay(i)}
                className={clsx(
                  'h-8 w-8 rounded-full border text-sm',
                  days[i]
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                    : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">開始時刻</span>
            <select
              value={startMin}
              onChange={(e) => setStartMin(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {times.slice(0, -1).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">終了時刻</span>
            <select
              value={endMin}
              onChange={(e) => setEndMin(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {times.slice(1).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="text-slate-600 dark:text-slate-300">タイトル</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: バイト、線形代数"
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

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

        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {preview.count > 0 ? (
            <>
              <span className="font-medium">{preview.count} 件</span>{' '}
              の予定が作成されます
              {preview.firstDates.length > 0 && (
                <>（例: {preview.firstDates.join(', ')}
                {preview.count > preview.firstDates.length && ' ...'}）</>
              )}
            </>
          ) : (
            '条件に合う日付がありません'
          )}
        </div>

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
            disabled={preview.count === 0}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            {preview.count} 件を作成
          </button>
        </div>
      </form>
    </div>
  );
}
