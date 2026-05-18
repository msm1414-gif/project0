'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { addDays, addMonths, startOfWeek } from 'date-fns';
import WeekView from '@/components/calendar/WeekView';
import MonthView from '@/components/calendar/MonthView';
import MobileCalendarView from '@/components/calendar/MobileCalendarView';
import { useApp } from '@/lib/store';
import { loadSettings, saveSettings } from '@/lib/settings';
import { formatDate, parseDate, todayStr } from '@/lib/time';

type Mode = 'week' | 'month';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function CalendarInner() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const pullNow = useApp((s) => s.pullNow);
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('t');
  const forceView = searchParams.get('view'); // 'mobile' | 'week' | 'month' | null

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!tokenFromUrl || !TOKEN_RE.test(tokenFromUrl)) return;
    if (loadSettings().shareToken === tokenFromUrl) return;
    saveSettings({ shareToken: tokenFromUrl });
    void pullNow();
  }, [tokenFromUrl, pullNow]);

  // Decide which view to render (mobile UA / narrow viewport)
  const isMobile = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => isMobileUA() || window.innerWidth < 640,
    () => false,
  );

  const useMobile =
    forceView === 'mobile' || (forceView !== 'week' && forceView !== 'month' && isMobile);

  if (useMobile) {
    return <MobileCalendarView />;
  }

  return <DesktopCalendar initialMode={forceView === 'month' ? 'month' : 'week'} hydrated={hydrated} />;
}

function DesktopCalendar({ initialMode, hydrated }: { initialMode: Mode; hydrated: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [anchor, setAnchor] = useState<string>(todayStr());

  const title = useMemo(() => {
    const d = parseDate(anchor);
    if (mode === 'month') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    }
    const ws = startOfWeek(d, { weekStartsOn: 0 });
    const we = addDays(ws, 6);
    return `${ws.getFullYear()}年${ws.getMonth() + 1}月${ws.getDate()}日 – ${we.getMonth() + 1}月${we.getDate()}日`;
  }, [anchor, mode]);

  function shift(dir: -1 | 1) {
    const d = parseDate(anchor);
    setAnchor(formatDate(mode === 'week' ? addDays(d, dir * 7) : addMonths(d, dir)));
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">{title}</h1>
        <div className="flex rounded border border-slate-300 text-sm dark:border-slate-600">
          <button
            type="button"
            onClick={() => setMode('week')}
            className={clsx('px-3 py-1', mode === 'week' && 'bg-slate-900 text-white dark:bg-white dark:text-slate-900')}
          >
            週
          </button>
          <button
            type="button"
            onClick={() => setMode('month')}
            className={clsx('px-3 py-1', mode === 'month' && 'bg-slate-900 text-white dark:bg-white dark:text-slate-900')}
          >
            月
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAnchor(todayStr())}
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          今日
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            aria-label="前へ"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            aria-label="次へ"
          >
            →
          </button>
        </div>
        <Link
          href="/calendar?view=mobile"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          連続表示
        </Link>
        <Link
          href="/"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          今日のタイムボクシング
        </Link>
      </header>

      {!hydrated ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          読み込み中...
        </div>
      ) : mode === 'week' ? (
        <WeekView anchor={anchor} />
      ) : (
        <MonthView anchor={anchor} />
      )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">読み込み中...</div>}>
      <CalendarInner />
    </Suspense>
  );
}
