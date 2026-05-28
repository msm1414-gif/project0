'use client';

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import {
  DAY_MINUTES,
  GRID_HEIGHT,
  PX_PER_HOUR,
  formatDate,
  formatMinutes,
  minutesToPx,
  parseDate,
  pxToMinutes,
  snap,
  todayStr,
} from '@/lib/time';
import { isJapaneseHoliday } from '@/lib/holidays';
import { calendarTodosByDate } from '@/lib/todo-calendar';
import CurrentTimeLine from '@/components/timebox/CurrentTimeLine';
import EventBlock from '@/components/timebox/EventBlock';
import NewEventDialog from '@/components/timebox/NewEventDialog';
import QuickAddDialog from '@/components/calendar/QuickAddDialog';
import SettingsDialog from '@/components/settings/SettingsDialog';
import type { Event } from '@/lib/types';
import {
  BookOpenIcon,
  CalendarIcon,
  CalendarTodayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SettingsIcon,
} from '@/components/ui/Icon';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function WeekInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const queryDate = sp.get('d');
  const today = todayStr();
  const anchorDate = queryDate && DATE_RE.test(queryDate) ? queryDate : today;

  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const events = useApp((s) => s.events);
  const todos = useApp((s) => s.todos);
  const updateEvent = useApp((s) => s.updateEvent);
  const removeEvent = useApp((s) => s.removeEvent);
  const removeGroup = useApp((s) => s.removeGroup);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const weekStart = useMemo(
    () => startOfWeek(parseDate(anchorDate), { weekStartsOn: 0 }),
    [anchorDate],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => formatDate(addDays(weekStart, i))),
    [weekStart],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<
    { date: string; start: number; end: number } | null
  >(null);
  const [editEvent, setEditEvent] = useState<Event | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to ~7am on mount so the day is visible
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = minutesToPx(7 * 60);
  }, []);

  function shift(weeks: number) {
    const next = formatDate(addDays(weekStart, weeks * 7));
    if (next === todayStr()) router.replace('/week');
    else router.replace(`/week?d=${next}`);
  }

  function jumpToToday() {
    router.replace('/week');
  }

  function onColumnClick(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if ((e.target as HTMLElement).closest('[data-event-block]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const start = Math.max(0, Math.min(DAY_MINUTES - 60, snap(pxToMinutes(y))));
    const end = Math.min(DAY_MINUTES, start + 60);
    setQuickAdd({ date, start, end });
  }

  const todoMap = calendarTodosByDate(todos);

  const endDate = addDays(weekStart, 6);
  const rangeLabel = `${weekStart.getFullYear()}.${String(weekStart.getMonth() + 1).padStart(2, '0')}.${String(weekStart.getDate()).padStart(2, '0')} – ${String(endDate.getMonth() + 1).padStart(2, '0')}.${String(endDate.getDate()).padStart(2, '0')}`;

  const isMobile = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => isMobileUA() || window.innerWidth < 640,
    () => false,
  );

  const gutterPx = isMobile ? 44 : 60;

  return (
    <div
      className="flex flex-col"
      style={{
        height: isMobile
          ? 'calc(100dvh - 64px - env(safe-area-inset-bottom))'
          : '100dvh',
      }}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3">
        <h1 className="tabular mr-auto text-lg font-semibold tracking-tight sm:text-xl">
          {rangeLabel}
        </h1>

        <div className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-0.5 text-sm">
          <button
            type="button"
            onClick={jumpToToday}
            className="rounded-full px-3 py-1 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
          >
            今週
          </button>
          <span className="h-4 w-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="前週"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="翌週"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
          >
            <CalendarTodayIcon size={14} />
            今日
          </Link>
          <Link
            href="/calendar"
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
          >
            <CalendarIcon size={14} />
            月
          </Link>
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
          >
            <SettingsIcon size={15} />
          </button>
        </div>
      </header>

      {/* Sticky day-of-week header */}
      <div
        className="grid border-b border-[var(--border)] bg-[var(--bg-elev)]"
        style={{ gridTemplateColumns: `${gutterPx}px repeat(7, 1fr)` }}
      >
        <div className="border-r border-[var(--border)]" />
        {days.map((date) => {
          const d = parseDate(date);
          const dow = d.getDay();
          const isToday = date === today;
          const isHoliday = isJapaneseHoliday(d);
          const dayTodos = todoMap.get(date) ?? [];
          return (
            <Link
              key={date}
              href={`/?date=${date}`}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 border-r border-[var(--border)] py-2',
                isHoliday && 'bg-rose-50/60 dark:bg-rose-500/10',
              )}
            >
              <span
                className={clsx(
                  'text-[10px] font-medium uppercase tracking-wider',
                  isHoliday
                    ? 'text-rose-500'
                    : dow === 0
                      ? 'text-rose-500'
                      : dow === 6
                        ? 'text-sky-500'
                        : 'text-[var(--fg-muted)]',
                )}
              >
                {WEEKDAYS[dow]}
              </span>
              <span
                className={clsx(
                  'tabular flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-sm font-semibold',
                  isToday && 'bg-[var(--fg)] text-[var(--bg)]',
                  !isToday && isHoliday && 'text-rose-600 dark:text-rose-400',
                  !isToday && !isHoliday && dow === 0 && 'text-rose-500',
                  !isToday && !isHoliday && dow === 6 && 'text-sky-500',
                  !isToday && !isHoliday && dow !== 0 && dow !== 6 && 'text-[var(--fg)]',
                )}
              >
                {d.getDate()}
              </span>
              {dayTodos.length > 0 && (
                <span
                  className="mt-0.5 text-[9px] text-rose-600 dark:text-rose-400"
                  title={dayTodos.map((t) => t.title).join(', ')}
                >
                  ● {dayTodos.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[var(--bg)]">
        {hydrated ? (
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `${gutterPx}px repeat(7, 1fr)`,
              height: GRID_HEIGHT,
            }}
          >
            {/* Hour gutter */}
            <div className="relative select-none border-r border-[var(--border)] text-right text-[11px] font-medium text-[var(--fg-subtle)]">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ height: PX_PER_HOUR }} className="relative pr-1.5">
                  {h === 0 ? null : (
                    <span className="tabular absolute right-1.5 -top-2 bg-[var(--bg)] px-1">
                      {formatMinutes(h * 60)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((date) => {
              const d = parseDate(date);
              const isToday = date === today;
              const isHoliday = isJapaneseHoliday(d);
              const dayEvents = events
                .filter((e) => e.date === date && !e.allDay && !e.timetableId)
                .sort((a, b) => a.startMinutes - b.startMinutes);
              const ttEvents = events
                .filter((e) => e.date === date && !e.allDay && !!e.timetableId)
                .sort((a, b) => a.startMinutes - b.startMinutes);
              const allDayEvents = [...ttEvents, ...dayEvents];
              const fivePx = minutesToPx(5);
              const halfPx = minutesToPx(30);
              const hourPx = minutesToPx(60);
              return (
                <div
                  key={date}
                  onClick={(e) => onColumnClick(e, date)}
                  className={clsx(
                    'relative cursor-pointer border-r border-[var(--border)]',
                    isHoliday && 'bg-rose-50/40 dark:bg-rose-500/5',
                  )}
                  style={{
                    backgroundImage: [
                      `repeating-linear-gradient(to bottom, rgba(148,163,184,0.10) 0 1px, transparent 1px ${fivePx}px)`,
                      `repeating-linear-gradient(to bottom, rgba(148,163,184,0.22) 0 1px, transparent 1px ${halfPx}px)`,
                      `repeating-linear-gradient(to bottom, rgba(100,116,139,0.38) 0 1px, transparent 1px ${hourPx}px)`,
                    ].join(', '),
                  }}
                >
                  {allDayEvents.map((ev) => (
                    <div key={ev.id} data-event-block>
                      <EventBlock
                        event={ev}
                        dense
                        onChange={(patch) => updateEvent(ev.id, patch)}
                        onClick={() => setEditEvent(ev)}
                      />
                    </div>
                  ))}
                  {isToday && <CurrentTimeLine />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--fg-muted)]">読み込み中...</div>
        )}
      </div>

      <QuickAddDialog
        open={quickAdd !== null}
        date={quickAdd?.date ?? today}
        defaultStart={quickAdd?.start}
        defaultEnd={quickAdd?.end}
        onClose={() => setQuickAdd(null)}
      />
      <NewEventDialog
        open={editEvent !== null}
        event={editEvent ?? undefined}
        onClose={() => setEditEvent(null)}
        onSave={(data) => {
          if (!editEvent) return;
          updateEvent(editEvent.id, data);
          setEditEvent(null);
        }}
        onDelete={() => {
          if (!editEvent) return;
          removeEvent(editEvent.id);
          setEditEvent(null);
        }}
        onDeleteGroup={() => {
          if (!editEvent) return;
          const gid = editEvent.recurringGroupId;
          if (gid) removeGroup(gid);
          setEditEvent(null);
        }}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function WeekPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-[var(--fg-muted)]">読み込み中...</div>}
    >
      <WeekInner />
    </Suspense>
  );
}
