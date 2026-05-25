'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { formatMinutes, parseDate, todayStr } from '@/lib/time';
import type { Event } from '@/lib/types';
import { isNotionConfigured, loadSettings } from '@/lib/settings';
import { createNotionPage, ensureSubjectPage, heading2, paragraph } from '@/lib/notion-client';
import {
  CalendarTodayIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SettingsIcon,
} from '@/components/ui/Icon';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function SubjectDetailPage({ params }: PageProps) {
  const { name } = use(params);
  const subjectTitle = decodeURIComponent(name);

  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const events = useApp((s) => s.events);
  const updateEvent = useApp((s) => s.updateEvent);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const lectures = useMemo(() => {
    return events
      .filter((e) => e.category === 'university' && e.title === subjectTitle)
      .sort((a, b) =>
        a.date === b.date ? a.startMinutes - b.startMinutes : a.date.localeCompare(b.date),
      );
  }, [events, subjectTitle]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          href="/subjects"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
          aria-label="科目一覧へ"
        >
          <ChevronLeftIcon size={16} />
        </Link>
        <div className="mr-auto flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLES.university.swatch}`} />
          <h1 className="text-xl font-semibold tracking-tight">{subjectTitle}</h1>
          <span className="tabular text-sm text-[var(--fg-muted)]">{lectures.length}回</span>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <CalendarTodayIcon size={14} />
          今日
        </Link>
      </header>

      {!hydrated ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--fg-muted)]">
          読み込み中...
        </div>
      ) : lectures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--fg-muted)]">
          この科目の講義はありません。
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {lectures.map((ev, i) => (
            <LectureRow
              key={ev.id}
              index={i + 1}
              event={ev}
              subject={subjectTitle}
              onCreateNotion={async () => {
                const subjectPageId = await ensureSubjectPage(subjectTitle);
                const page = await createNotionPage(subjectPageId, `${ev.date} ${subjectTitle}`, [
                  heading2('メモ'),
                  paragraph(ev.notes ?? ''),
                  heading2('講義資料'),
                  paragraph(''),
                ]);
                updateEvent(ev.id, { notionPageUrl: page.url, notionPageId: page.id });
              }}
            />
          ))}
        </ol>
      )}
    </main>
  );
}

function LectureRow({
  index,
  event,
  subject,
  onCreateNotion,
}: {
  index: number;
  event: Event;
  subject: string;
  onCreateNotion: () => Promise<void>;
}) {
  const d = parseDate(event.date);
  const isPast = event.date < todayStr();
  const weekday = WEEKDAYS[d.getDay()];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const notionConfigured = isNotionConfigured(loadSettings());

  async function handleCreate() {
    setErr(null);
    setBusy(true);
    try {
      await onCreateNotion();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={clsx(
        'rounded-xl border bg-[var(--bg-elev)] p-3.5 shadow-sm transition',
        isPast
          ? 'border-[var(--border)] opacity-70'
          : 'border-[var(--border-strong)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular min-w-[3rem] rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-center text-[11px] font-medium text-[var(--fg-muted)]">
          #{index}
        </span>
        <span className="tabular text-sm font-semibold">
          {event.date}
        </span>
        <span className="text-xs text-[var(--fg-muted)]">({weekday})</span>
        <span className="tabular text-sm text-[var(--fg-muted)]">
          {formatMinutes(event.startMinutes)}–{formatMinutes(event.endMinutes)}
        </span>
        <Link
          href={`/?date=${event.date}`}
          className="ml-auto text-xs text-[var(--fg-muted)] underline-offset-2 hover:text-[var(--fg)] hover:underline"
        >
          この日を開く
        </Link>
      </div>

      {event.notes && (
        <div className="mt-2 whitespace-pre-wrap rounded-md bg-[var(--bg-soft)] px-2.5 py-1.5 text-xs text-[var(--fg-muted)]">
          {event.notes}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {event.notionPageUrl ? (
          <a
            href={event.notionPageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md text-sky-600 hover:text-sky-700 dark:text-sky-400"
          >
            <FileTextIcon size={12} />
            Notion ノート
            <ExternalLinkIcon size={11} />
          </a>
        ) : notionConfigured ? (
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] hover:border-[var(--border-strong)] disabled:opacity-40"
            title={`${subject} / ${event.date}`}
          >
            <FileTextIcon size={12} />
            {busy ? '作成中…' : 'Notion ノートを作成'}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-subtle)]">
            <SettingsIcon size={11} />
            設定で Notion 連携するとノートが生成できます
          </span>
        )}
        {err && <span className="text-rose-500">{err}</span>}
      </div>
    </li>
  );
}
