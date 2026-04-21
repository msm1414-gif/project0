'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { Category, Event } from '@/lib/types';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { DAY_MINUTES, formatMinutes, timeOptions } from '@/lib/time';

type Draft = {
  title: string;
  category: Category | 'auto';
  startMinutes: number;
  endMinutes: number;
};

interface Props {
  open: boolean;
  event?: Event;
  initial?: { startMinutes: number; endMinutes: number };
  onSave: (data: { title: string; category: Category; startMinutes: number; endMinutes: number }) => void;
  onDelete?: () => void;
  onDeleteGroup?: () => void;
  onClose: () => void;
}

function DialogBody({ event, initial, onSave, onDelete, onDeleteGroup, onClose }: Omit<Props, 'open'>) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (event) {
      return {
        title: event.title,
        category: event.category,
        startMinutes: event.startMinutes,
        endMinutes: event.endMinutes,
      };
    }
    return {
      title: '',
      category: 'auto',
      startMinutes: initial?.startMinutes ?? 9 * 60,
      endMinutes: initial?.endMinutes ?? 10 * 60,
    };
  });

  const times = timeOptions();
  const resolvedCategory: Category = draft.category === 'auto' ? inferCategory(draft.title) : draft.category;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (draft.endMinutes <= draft.startMinutes) return;
    onSave({
      title: draft.title.trim() || '(無題)',
      category: resolvedCategory,
      startMinutes: draft.startMinutes,
      endMinutes: Math.min(DAY_MINUTES, draft.endMinutes),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">{event ? '予定を編集' : '新しい予定'}</h2>

        <label className="mt-4 block text-sm">
          <span className="text-slate-600 dark:text-slate-300">タイトル</span>
          <input
            autoFocus
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="例: 線形代数の講義"
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">開始</span>
            <select
              value={draft.startMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, startMinutes: Number(e.target.value) }))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {times.slice(0, -1).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">終了</span>
            <select
              value={draft.endMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, endMinutes: Number(e.target.value) }))}
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
              onClick={() => setDraft((d) => ({ ...d, category: 'auto' }))}
              className={clsx(
                'rounded-full px-3 py-1 text-xs border',
                draft.category === 'auto'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
              )}
            >
              自動 ({CATEGORY_LABELS[inferCategory(draft.title)]})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border',
                  draft.category === cat
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {event && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                削除
              </button>
            )}
            {event?.recurringGroupId && onDeleteGroup && (
              <button
                type="button"
                onClick={onDeleteGroup}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                繰り返し全削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
              保存
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewEventDialog({ open, ...rest }: Props) {
  if (!open) return null;
  const key = rest.event
    ? `edit-${rest.event.id}`
    : `new-${rest.initial?.startMinutes}-${rest.initial?.endMinutes}`;
  return <DialogBody key={key} {...rest} />;
}
