'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { Category, Event } from '@/lib/types';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { DAY_MINUTES, formatMinutes, timeOptions } from '@/lib/time';
import { isNotionConfigured, loadSettings } from '@/lib/settings';
import { createNotionPage, ensureSubjectPage, heading2, paragraph } from '@/lib/notion-client';
import { useApp } from '@/lib/store';
import {
  ExternalLinkIcon,
  FileTextIcon,
  SettingsIcon,
  SparklesIcon,
  TrashIcon,
} from '@/components/ui/Icon';

type Draft = {
  title: string;
  category: Category | 'auto';
  startMinutes: number;
  endMinutes: number;
  notes: string;
  tentative: boolean;
};

export interface EventFormData {
  title: string;
  category: Category;
  startMinutes: number;
  endMinutes: number;
  notes?: string;
  tentative: boolean;
}

interface Props {
  open: boolean;
  event?: Event;
  initial?: { startMinutes: number; endMinutes: number };
  onSave: (data: EventFormData) => void;
  onDelete?: () => void;
  onDeleteGroup?: () => void;
  onClose: () => void;
}

function DialogBody({
  event,
  initial,
  onSave,
  onDelete,
  onDeleteGroup,
  onClose,
}: Omit<Props, 'open'>) {
  const [draft, setDraft] = useState<Draft>(() => {
    if (event) {
      return {
        title: event.title,
        category: event.category,
        startMinutes: event.startMinutes,
        endMinutes: event.endMinutes,
        notes: event.notes ?? '',
        tentative: !!event.tentative,
      };
    }
    return {
      title: '',
      category: 'auto',
      startMinutes: initial?.startMinutes ?? 9 * 60,
      endMinutes: initial?.endMinutes ?? 10 * 60,
      notes: '',
      tentative: false,
    };
  });

  const updateEvent = useApp((s) => s.updateEvent);
  const storeEvent = useApp((s) => (event ? s.events.find((e) => e.id === event.id) : undefined));
  const notionUrl = storeEvent?.notionPageUrl ?? event?.notionPageUrl;

  const [notionBusy, setNotionBusy] = useState(false);
  const [notionError, setNotionError] = useState<string | null>(null);

  const times = timeOptions();
  const resolvedCategory: Category =
    draft.category === 'auto' ? inferCategory(draft.title) : draft.category;
  const notionConfigured = isNotionConfigured(loadSettings());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (draft.endMinutes <= draft.startMinutes) return;
    onSave({
      title: draft.title.trim() || '(無題)',
      category: resolvedCategory,
      startMinutes: draft.startMinutes,
      endMinutes: Math.min(DAY_MINUTES, draft.endMinutes),
      notes: draft.notes,
      tentative: draft.tentative,
    });
  }

  async function createNotion() {
    if (!event) return;
    setNotionError(null);
    setNotionBusy(true);
    try {
      const title = event.title;
      const subjectPageId = await ensureSubjectPage(title);
      const page = await createNotionPage(subjectPageId, `${event.date} ${title}`, [
        heading2('メモ'),
        paragraph(draft.notes || ''),
        heading2('講義資料'),
        paragraph(''),
      ]);
      updateEvent(event.id, { notionPageUrl: page.url, notionPageId: page.id });
    } catch (err) {
      setNotionError(err instanceof Error ? err.message : String(err));
    } finally {
      setNotionBusy(false);
    }
  }

  const showNotionSection = event && resolvedCategory === 'university';

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
        <h2 className="text-lg font-semibold tracking-tight">
          {event ? '予定を編集' : '新しい予定'}
        </h2>

        <label className="mt-5 block">
          <span className="text-xs font-medium text-[var(--fg-muted)]">タイトル</span>
          <input
            autoFocus
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="例: 線形代数の講義"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-base placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[var(--fg-muted)]">開始</span>
            <select
              value={draft.startMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, startMinutes: Number(e.target.value) }))}
              className="tabular mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
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
              value={draft.endMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, endMinutes: Number(e.target.value) }))}
              className="tabular mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
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
              onClick={() => setDraft((d) => ({ ...d, category: 'auto' }))}
              className={clsx(
                'flex items-center gap-1 rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                draft.category === 'auto'
                  ? 'bg-[var(--fg)] text-[var(--bg)] ring-[var(--fg)]'
                  : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
              )}
            >
              <SparklesIcon size={11} />
              自動 ({CATEGORY_LABELS[inferCategory(draft.title)]})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                  draft.category === cat
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

        <label className="mt-4 block">
          <span className="text-xs font-medium text-[var(--fg-muted)]">メモ</span>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            rows={3}
            placeholder="簡単なメモ（詳細な講義ノートは Notion 側に）"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--fg-subtle)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </label>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.tentative}
              onChange={(e) => setDraft((d) => ({ ...d, tentative: e.target.checked }))}
              className="h-4 w-4 accent-[var(--fg)]"
            />
            <span className="text-[var(--fg)]">
              仮置き
              <span className="text-[var(--fg-subtle)]"> ・ 破線・薄色で表示</span>
            </span>
          </label>
          {draft.tentative && (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, tentative: false }))}
              className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-600"
            >
              ✓ 本登録
            </button>
          )}
        </div>

        {showNotionSection && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <FileTextIcon size={14} />
              Notion 講義ノート
            </div>
            {notionUrl ? (
              <div className="mt-2">
                <a
                  href={notionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400"
                >
                  Notion ページを開く
                  <ExternalLinkIcon size={12} />
                </a>
              </div>
            ) : notionConfigured ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={createNotion}
                  disabled={notionBusy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs hover:border-[var(--border-strong)] disabled:opacity-40"
                >
                  <FileTextIcon size={12} />
                  {notionBusy ? '作成中…' : 'Notion ノートを作成'}
                </button>
                {notionError && (
                  <div className="mt-2 text-xs text-rose-500">{notionError}</div>
                )}
              </div>
            ) : (
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600">
                <SettingsIcon size={11} />
                設定で Notion 連携を済ませると、ここから講義ノートを自動作成できます。
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {event && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300/70 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
              >
                <TrashIcon size={13} />
                削除
              </button>
            )}
            {event?.recurringGroupId && onDeleteGroup && (
              <button
                type="button"
                onClick={onDeleteGroup}
                className="rounded-lg border border-rose-300/70 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
              >
                繰り返し全削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
