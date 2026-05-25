'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { eachDayOfInterval } from 'date-fns';
import type { Category } from '@/lib/types';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import { inferCategory } from '@/lib/categorize';
import { DAY_MINUTES, formatDate, parseDate, timeOptions, todayStr } from '@/lib/time';
import { holidayName, isJapaneseHoliday } from '@/lib/holidays';
import { useApp } from '@/lib/store';
import { isNotionConfigured, loadSettings } from '@/lib/settings';
import { createNotionPage, ensureSubjectPage, heading2, paragraph } from '@/lib/notion-client';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const PERIODS: { label: string; start: number; end: number }[] = [
  { label: '1限', start: 8 * 60 + 30, end: 10 * 60 },
  { label: '2限', start: 10 * 60 + 25, end: 11 * 60 + 55 },
  { label: '3限', start: 13 * 60 + 15, end: 14 * 60 + 45 },
  { label: '4限', start: 15 * 60 + 10, end: 16 * 60 + 40 },
  { label: '5限', start: 17 * 60 + 5, end: 18 * 60 + 35 },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BulkRegisterDialog({ open, onClose }: Props) {
  const addEvents = useApp((s) => s.addEvents);
  const updateEvent = useApp((s) => s.updateEvent);
  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [startMin, setStartMin] = useState(9 * 60);
  const [endMin, setEndMin] = useState(10 * 60 + 30);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | 'auto'>('auto');
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [createNotion, setCreateNotion] = useState(true);
  const [notionProgress, setNotionProgress] = useState<string | null>(null);

  const resolvedCategory: Category = category === 'auto' ? inferCategory(title) : category;

  const preview = useMemo(() => {
    if (!startDate || !endDate) {
      return { count: 0, firstDates: [] as string[], skipped: [] as { date: string; name: string }[] };
    }
    const sd = parseDate(startDate);
    const ed = parseDate(endDate);
    if (sd > ed) return { count: 0, firstDates: [], skipped: [] };
    const weekdayMatched = eachDayOfInterval({ start: sd, end: ed }).filter((d) => days[d.getDay()]);
    const kept: Date[] = [];
    const skipped: { date: string; name: string }[] = [];
    for (const d of weekdayMatched) {
      if (excludeHolidays && isJapaneseHoliday(d)) {
        skipped.push({ date: formatDate(d), name: holidayName(d) ?? '祝日' });
      } else {
        kept.push(d);
      }
    }
    return {
      count: kept.length,
      firstDates: kept.slice(0, 3).map((d) => formatDate(d)),
      skipped,
    };
  }, [startDate, endDate, days, excludeHolidays]);

  if (!open) return null;

  function toggleDay(i: number) {
    setDays((prev) => prev.map((v, j) => (j === i ? !v : v)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (endMin <= startMin) return;
    const sd = parseDate(startDate);
    const ed = parseDate(endDate);
    if (sd > ed) return;
    const dates = eachDayOfInterval({ start: sd, end: ed })
      .filter((d) => days[d.getDay()])
      .filter((d) => !(excludeHolidays && isJapaneseHoliday(d)));
    if (dates.length === 0) return;
    const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resolvedTitle = title.trim() || '(無題)';
    const created = addEvents(
      dates.map((d) => ({
        title: resolvedTitle,
        category: resolvedCategory,
        date: formatDate(d),
        startMinutes: startMin,
        endMinutes: Math.min(DAY_MINUTES, endMin),
        recurringGroupId: groupId,
      })),
    );

    const shouldNotion =
      createNotion &&
      resolvedCategory === 'university' &&
      isNotionConfigured(loadSettings());

    if (!shouldNotion) {
      onClose();
      return;
    }

    try {
      setNotionProgress('科目ページを確認中...');
      const subjectPageId = await ensureSubjectPage(resolvedTitle);
      for (let i = 0; i < created.length; i++) {
        const ev = created[i];
        setNotionProgress(`ノート作成中 ${i + 1}/${created.length} (${ev.date})`);
        const pageTitle = `${ev.date} ${resolvedTitle}`;
        const page = await createNotionPage(subjectPageId, pageTitle, [
          heading2('メモ'),
          paragraph(''),
          heading2('講義資料'),
          paragraph(''),
        ]);
        updateEvent(ev.id, { notionPageUrl: page.url, notionPageId: page.id });
      }
      setNotionProgress(null);
      onClose();
    } catch (err) {
      setNotionProgress(
        `エラー: ${err instanceof Error ? err.message : String(err)}。予定は作成済みです。`,
      );
    }
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
        className="w-full max-w-lg rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl shadow-black/10 sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">期間指定で一括登録</h2>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          期間内の指定曜日に同じ予定をまとめて作成します。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-[var(--fg-muted)]">開始日</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-[var(--fg-muted)]">終了日</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-3">
          <div className="text-xs font-medium text-[var(--fg-muted)]">曜日</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleDay(i)}
                className={clsx(
                  'h-8 w-8 rounded-full text-sm ring-1 ring-inset',
                  days[i]
                    ? 'bg-[var(--fg)] text-[var(--bg)] ring-[var(--fg)]'
                    : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={excludeHolidays}
            onChange={(e) => setExcludeHolidays(e.target.checked)}
            className="h-4 w-4 accent-[var(--fg)]"
          />
          <span className="text-[var(--fg-muted)]">祝日を除く（日本の祝日・振替休日）</span>
        </label>

        <div className="mt-3">
          <div className="text-xs font-medium text-[var(--fg-muted)]">時限ショートカット</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {PERIODS.map((p) => {
              const active = startMin === p.start && endMin === p.end;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setStartMin(p.start);
                    setEndMin(p.end);
                  }}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                    active
                      ? 'bg-[var(--fg)] text-[var(--bg)] ring-[var(--fg)]'
                      : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
                  )}
                  title={`${Math.floor(p.start / 60)}:${String(p.start % 60).padStart(2, '0')}–${Math.floor(p.end / 60)}:${String(p.end % 60).padStart(2, '0')}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-[var(--fg-muted)]">開始時刻</span>
            <select
              value={startMin}
              onChange={(e) => setStartMin(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
            >
              {times.slice(0, -1).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-[var(--fg-muted)]">終了時刻</span>
            <select
              value={endMin}
              onChange={(e) => setEndMin(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
            >
              {times.slice(1).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="text-xs font-medium text-[var(--fg-muted)]">タイトル</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: バイト、線形代数"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--border-strong)] focus:outline-none"
          />
        </label>

        <div className="mt-3">
          <div className="text-xs font-medium text-[var(--fg-muted)]">カテゴリ</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory('auto')}
              className={clsx(
                'rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                category === 'auto'
                  ? 'bg-[var(--fg)] text-[var(--bg)] ring-[var(--fg)]'
                  : 'text-[var(--fg-muted)] ring-[var(--border)] hover:ring-[var(--border-strong)]',
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

        {resolvedCategory === 'university' && (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={createNotion}
              onChange={(e) => setCreateNotion(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--fg)]"
            />
            <span className="text-xs font-medium text-[var(--fg-muted)]">
              Notion に講義ノートページも作成する
              {!isNotionConfigured(loadSettings()) && (
                <span className="ml-1 text-[11px] text-amber-600">（⚙️ 設定で Notion 連携を済ませてください）</span>
              )}
            </span>
          </label>
        )}

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs text-[var(--fg-muted)]">
          {preview.count > 0 ? (
            <>
              <span className="tabular font-semibold text-[var(--fg)]">{preview.count} 件</span>{' '}
              の予定が作成されます
              {preview.firstDates.length > 0 && (
                <span className="tabular">
                  （例: {preview.firstDates.join(', ')}
                  {preview.count > preview.firstDates.length && ' …'}）
                </span>
              )}
            </>
          ) : (
            '条件に合う日付がありません'
          )}
          {preview.skipped.length > 0 && (
            <div className="tabular mt-1 text-[var(--fg-subtle)]">
              祝日 {preview.skipped.length} 件を除外（
              {preview.skipped.slice(0, 3).map((s) => `${s.date} ${s.name}`).join(' / ')}
              {preview.skipped.length > 3 && ' …'}）
            </div>
          )}
        </div>

        {notionProgress && (
          <div className="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/70 p-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            {notionProgress}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={notionProgress !== null && !notionProgress.startsWith('エラー')}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)] disabled:opacity-40"
          >
            {notionProgress?.startsWith('エラー') ? '閉じる' : 'キャンセル'}
          </button>
          <button
            type="submit"
            disabled={preview.count === 0 || notionProgress !== null}
            className="rounded-lg bg-[var(--fg)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-30"
          >
            {preview.count} 件を作成
          </button>
        </div>
      </form>
    </div>
  );
}
