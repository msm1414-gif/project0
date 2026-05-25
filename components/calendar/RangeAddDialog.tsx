'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { eachDayOfInterval } from 'date-fns';
import { useApp } from '@/lib/store';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { formatDate, parseDate } from '@/lib/time';
import { ArrowLeftRightIcon, SparklesIcon } from '@/components/ui/Icon';

interface Props {
  open: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

function newGroupId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return `range-${crypto.randomUUID()}`;
  return `range-${Date.now().toString(36)}`;
}

export default function RangeAddDialog({ open, startDate, endDate, onClose }: Props) {
  if (!open) return null;
  return (
    <Body
      key={`${startDate}-${endDate}`}
      startDate={startDate}
      endDate={endDate}
      onClose={onClose}
    />
  );
}

function Body({
  startDate,
  endDate,
  onClose,
}: {
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl shadow-black/10 sm:rounded-2xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ArrowLeftRightIcon size={18} />
          範囲予定を追加
        </h2>
        <div className="tabular mt-1 text-sm text-[var(--fg-muted)]">
          {sortedStart} – {sortedEnd} ({days.length}日間・終日)
        </div>
        <div className="mt-1 text-[11px] text-[var(--fg-subtle)]">
          ※ 範囲予定はタイムボクシング画面には表示されません
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-[var(--fg-muted)]">タイトル</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 合宿、旅行、出張"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </label>

        <div className="mt-3">
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

        <label className="mt-3 block">
          <span className="text-xs font-medium text-[var(--fg-muted)]">メモ (任意)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="場所・持ち物など"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tentative}
            onChange={(e) => setTentative(e.target.checked)}
            className="h-4 w-4 accent-[var(--fg)]"
          />
          <span className="text-[var(--fg-muted)]">仮置きとして追加</span>
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
            {days.length}日分を追加
          </button>
        </div>
      </form>
    </div>
  );
}
