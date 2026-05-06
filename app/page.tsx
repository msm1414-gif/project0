'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays } from 'date-fns';
import TimeboxGrid from '@/components/timebox/TimeboxGrid';
import TodoSidebar from '@/components/todo/TodoSidebar';
import BulkRegisterDialog from '@/components/bulk/BulkRegisterDialog';
import SettingsDialog from '@/components/settings/SettingsDialog';
import TimetableGridDialog from '@/components/timetable/TimetableGridDialog';
import { useApp } from '@/lib/store';
import { loadSettings, saveSettings } from '@/lib/settings';
import { formatDate, parseDate, todayStr } from '@/lib/time';
import { calendarTodosByDate, todoIcon } from '@/lib/todo-calendar';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

function HomeInner() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const pullNow = useApp((s) => s.pullNow);
  const todos = useApp((s) => s.todos);

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryDate = searchParams.get('date');
  const tokenFromUrl = searchParams.get('t');
  const selectedDate = queryDate && DATE_RE.test(queryDate) ? queryDate : todayStr();
  const dayTodos = calendarTodosByDate(todos).get(selectedDate) ?? [];

  const [bulkOpen, setBulkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!tokenFromUrl || !TOKEN_RE.test(tokenFromUrl)) return;
    if (loadSettings().shareToken === tokenFromUrl) return;
    saveSettings({ shareToken: tokenFromUrl });
    void pullNow();
  }, [tokenFromUrl, pullNow]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function setDate(d: string) {
    if (d === todayStr()) {
      router.replace('/');
    } else {
      router.replace(`/?date=${d}`);
    }
  }

  function shift(dir: -1 | 1) {
    setDate(formatDate(addDays(parseDate(selectedDate), dir)));
  }

  const d = parseDate(selectedDate);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          {d.getFullYear()}年{d.getMonth() + 1}月{d.getDate()}日 ({weekday})
        </h1>
        <button
          type="button"
          onClick={() => setDate(todayStr())}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          今日
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            aria-label="前日"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            aria-label="翌日"
          >
            →
          </button>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          + 一括登録
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          title="グリッドから時間割を一括登録"
        >
          🗓️ 時間割
        </button>
        <Link
          href="/calendar"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          カレンダー
        </Link>
        <Link
          href="/subjects"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          科目
        </Link>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          aria-label="設定"
          title="設定"
        >
          ⚙️
        </button>
      </header>

      {dayTodos.length > 0 && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30">
          <div className="mb-1 text-xs font-semibold text-rose-700 dark:text-rose-300">この日の試験・課題</div>
          <ul className="flex flex-wrap gap-2 text-sm">
            {dayTodos.map((t) => (
              <li
                key={t.id}
                className="rounded-full bg-rose-100 px-3 py-1 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200"
              >
                {todoIcon(t.title)} {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_280px]">
        <section className="overflow-y-auto rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {hydrated ? (
            <TimeboxGrid date={selectedDate} />
          ) : (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          {hydrated ? <TodoSidebar /> : <div className="text-slate-500">読み込み中...</div>}
        </section>
      </div>

      <BulkRegisterDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TimetableGridDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">読み込み中...</div>}>
      <HomeInner />
    </Suspense>
  );
}
