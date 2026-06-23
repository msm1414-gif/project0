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
import QuickAddDialog from '@/components/calendar/QuickAddDialog';
import AddMenu from '@/components/timebox/AddMenu';
import { useApp } from '@/lib/store';
import { loadSettings, saveSettings } from '@/lib/settings';
import { formatDate, parseDate, todayStr } from '@/lib/time';
import { calendarTodosByDate, todoIcon } from '@/lib/todo-calendar';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SettingsIcon,
  BookOpenIcon,
} from '@/components/ui/Icon';
import ViewSwitcher from '@/components/ui/ViewSwitcher';

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
  const [quickAddOpen, setQuickAddOpen] = useState(false);

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
  const dow = d.getDay();
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][dow];
  const isToday = selectedDate === todayStr();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-baseline gap-3">
          <h1 className="tabular text-xl font-semibold tracking-tight">
            {d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, '0')}.
            {String(d.getDate()).padStart(2, '0')}
          </h1>
          <span
            className={
              dow === 0
                ? 'text-sm font-medium text-rose-500'
                : dow === 6
                  ? 'text-sm font-medium text-sky-500'
                  : 'text-sm font-medium text-[var(--fg-muted)]'
            }
          >
            {weekday}曜日
          </span>
          {isToday && (
            <span className="rounded-full bg-[var(--fg)] px-2 py-0.5 text-[10px] font-medium text-[var(--bg)]">
              TODAY
            </span>
          )}
        </div>

        {/* 日付ナビ */}
        <div className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setDate(todayStr())}
            className="rounded-full px-3 py-1 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
          >
            今日
          </button>
          <span className="h-4 w-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={() => shift(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
            aria-label="前日"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
            aria-label="翌日"
          >
            <ChevronRightIcon size={16} />
          </button>
          <span className="h-4 w-px bg-[var(--border)]" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="tabular w-32 rounded-full border-0 bg-transparent px-2 py-0.5 text-xs focus:outline-none"
          />
        </div>

        {/* 追加メニュー */}
        <AddMenu
          onQuickAdd={() => setQuickAddOpen(true)}
          onBulkRegister={() => setBulkOpen(true)}
          onTimetable={() => setImportOpen(true)}
        />

        {/* ビュー切替 (常時表示) */}
        <ViewSwitcher active="today" />

        {/* PC 用の補助ナビ */}
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/subjects"
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
          >
            <BookOpenIcon size={14} />
            科目
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
            aria-label="設定"
            title="設定"
          >
            <SettingsIcon size={15} />
          </button>
        </div>
      </header>

      {dayTodos.length > 0 && (
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            この日の試験・課題
          </div>
          <ul className="flex flex-wrap gap-1.5 text-sm">
            {dayTodos.map((t) => (
              <li
                key={t.id}
                className="rounded-full bg-white/70 px-3 py-1 text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-400/30"
              >
                {todoIcon(t.title)} {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_300px]">
        <section className="overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-sm">
          {hydrated ? (
            <TimeboxGrid date={selectedDate} />
          ) : (
            <div className="p-8 text-center text-sm text-[var(--fg-muted)]">読み込み中...</div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 shadow-sm">
          {hydrated ? <TodoSidebar /> : <div className="text-sm text-[var(--fg-muted)]">読み込み中...</div>}
        </section>
      </div>

      <BulkRegisterDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TimetableGridDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <QuickAddDialog
        open={quickAddOpen}
        date={selectedDate}
        onClose={() => setQuickAddOpen(false)}
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--fg-muted)]">読み込み中...</div>}>
      <HomeInner />
    </Suspense>
  );
}
