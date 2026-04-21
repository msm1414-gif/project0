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
      .sort((a, b) => (a.date === b.date ? a.startMinutes - b.startMinutes : a.date.localeCompare(b.date)));
  }, [events, subjectTitle]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${CATEGORY_STYLES.university.swatch}`} />
          <h1 className="text-xl font-semibold">{subjectTitle}</h1>
          <span className="text-sm text-slate-500">({lectures.length}回)</span>
        </div>
        <Link
          href="/subjects"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          科目一覧
        </Link>
        <Link
          href="/"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          タイムボクシング
        </Link>
      </header>

      {!hydrated ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          読み込み中...
        </div>
      ) : lectures.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
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
        'rounded-lg border bg-white p-3 dark:bg-slate-900',
        isPast ? 'border-slate-200 opacity-80 dark:border-slate-700' : 'border-slate-300 dark:border-slate-600',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[3rem] rounded bg-slate-100 px-2 py-0.5 text-center text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          第{index}回
        </span>
        <span className="text-sm font-semibold">
          {event.date} ({weekday})
        </span>
        <span className="text-sm text-slate-500">
          {formatMinutes(event.startMinutes)}–{formatMinutes(event.endMinutes)}
        </span>
        <Link
          href={`/?date=${event.date}`}
          className="ml-auto text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
        >
          この日を開く
        </Link>
      </div>

      {event.notes && (
        <div className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
          {event.notes}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {event.notionPageUrl ? (
          <a
            href={event.notionPageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
          >
            📝 Notion ノート
          </a>
        ) : notionConfigured ? (
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
            title={`${subject} / ${event.date}`}
          >
            {busy ? '作成中...' : '📝 Notion ノートを作成'}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">⚙️ 設定で Notion 連携するとここにノートが生成されます</span>
        )}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </li>
  );
}
