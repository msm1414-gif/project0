'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { eachDayOfInterval } from 'date-fns';
import { useApp } from '@/lib/store';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { formatDate, parseDate } from '@/lib/time';

interface Props {
  open: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

function newGroupId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `range-${crypto.randomUUID()}`;
  return `range-${Date.now().toString(36)}`;
}

export default function RangeAddDialog({ open, startDate, endDate, onClose }: Props) {
  if (!open) return null;
  return <Body key={`${startDate}-${endDate}`} startDate={startDate} endDate={endDate} onClose={onClose} />;
}

function Body({ startDate, endDate, onClose }: { startDate: string; endDate: string; onClose: () => void }) {
  const addEvents = useApp((s) => s.addEvents);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | 'auto'>('auto');
  const [tentative, setTentative] = useState(false);
  const [notes, setNotes] = useState('');

  const sortedStart = startDate <= endDate ? startDate : endDate;
  const sortedEnd = startDate <= endDate ? endDate : startDate;
  const days = eachDayOfInterval({ start: parseDate(sortedStart), end: parseDate(sortedEnd) });
  const resolvedCategory: Category = category === 'auto' ? inferCategory(title) : category;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (days.length === 0) return;
    const groupId = newGroupId();
    addEvents(
      days.map((d) => ({
        title: title.trim() || '(無題)',
        category: resolvedCategory,
        date: formatDate(d),
        startMinutes: 0,
        endMinutes: 0,
        allDay: true,
        recurringGroupId: groupId,
        ...(tentative ? { tentative: true } : {}),
        ...(notes ? { notes } : {}),
      })),
    );
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-2 sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-2xl sm:rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">↔ 範囲予定を追加</h2>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {sortedStart} 〜 {sortedEnd}（{days.length} 日間・終日扱い）
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          ※ 範囲予定はタイムボクシング画面には表示されません
        </div>

        <label className="mt-4 block text-sm">
          <span className="text-slate-600 dark:text-slate-300">タイトル</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 合宿、旅行、出張"
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-base dark:border-slate-700 dark:bg-slate-800"
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

        <label className="mt-3 block text-sm">
          <span className="text-slate-600 dark:text-slate-300">メモ (任意)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="場所・持ち物など"
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tentative}
            onChange={(e) => setTentative(e.target.checked)}
            className="h-4 w-4 accent-slate-700"
          />
          <span className="text-slate-600 dark:text-slate-300">仮置きとして追加</span>
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
            {days.length} 日分を追加
          </button>
        </div>
      </form>
    </div>
  );
}
