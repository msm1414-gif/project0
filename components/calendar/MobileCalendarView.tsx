'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { addDays, addMonths, eachDayOfInterval, endOfWeek, startOfWeek } from 'date-fns';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { formatDate, parseDate, todayStr } from '@/lib/time';
import { calendarTodosByDate, todoIcon } from '@/lib/todo-calendar';
import { isJapaneseHoliday } from '@/lib/holidays';
import QuickAddDialog from './QuickAddDialog';
import RangeAddDialog from './RangeAddDialog';
import NewEventDialog from '@/components/timebox/NewEventDialog';
import SettingsDialog from '@/components/settings/SettingsDialog';
import type { Event } from '@/lib/types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

const RANGE_BEFORE_MONTHS = 6;
const RANGE_AFTER_MONTHS = 12;

export default function MobileCalendarView() {
  const events = useApp((s) => s.events);
  const todos = useApp((s) => s.todos);

  const today = todayStr();
  const todayDate = parseDate(today);

  // Generate continuous date range (full weeks)
  const start = startOfWeek(addMonths(todayDate, -RANGE_BEFORE_MONTHS), { weekStartsOn: 0 });
  const end = endOfWeek(addMonths(todayDate, RANGE_AFTER_MONTHS), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end }).map((d) => formatDate(d));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState<string>(today.slice(0, 7));
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [rangeState, setRangeState] = useState<
    { kind: 'off' } | { kind: 'pick-start' } | { kind: 'pick-end'; start: string }
  >({ kind: 'off' });
  const [rangeDialog, setRangeDialog] = useState<{ start: string; end: string } | null>(null);
  const updateEvent = useApp((s) => s.updateEvent);
  const removeEvent = useApp((s) => s.removeEvent);
  const removeGroup = useApp((s) => s.removeGroup);

  const router = useRouter();
  const longPressRef = useRef<{
    date: string;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClickRef = useRef(false);

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }

  function onCellPointerDown(date: string, e: React.PointerEvent<HTMLElement>) {
    clearLongPress();
    if (rangeState.kind !== 'off') return; // 範囲選択モード中は長押し無効
    const startX = e.clientX;
    const startY = e.clientY;
    longPressRef.current = {
      date,
      startX,
      startY,
      timer: setTimeout(() => {
        longPressRef.current = null;
        suppressClickRef.current = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate?.(30);
          } catch {}
        }
        setAddOpen(date);
      }, 350),
    };
  }

  function onCellPointerMove(e: React.PointerEvent<HTMLElement>) {
    const lp = longPressRef.current;
    if (!lp) return;
    if (Math.abs(e.clientX - lp.startX) > 10 || Math.abs(e.clientY - lp.startY) > 10) {
      clearLongPress();
    }
  }

  function onCellPointerEnd() {
    clearLongPress();
  }

  function onCellClick(date: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (rangeState.kind === 'pick-start') {
      setRangeState({ kind: 'pick-end', start: date });
      return;
    }
    if (rangeState.kind === 'pick-end') {
      const [start, end] = [rangeState.start, date].sort();
      setRangeDialog({ start, end });
      setRangeState({ kind: 'off' });
      return;
    }
    router.push(`/?date=${date}`);
  }

  function scrollTo(date: string) {
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (!target) return;
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    container.scrollTop += targetTop - containerTop - 60;
  }

  // Scroll to today on mount
  useEffect(() => {
    scrollTo(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which month is most visible
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let rafId = 0;
    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const cells = container.querySelectorAll<HTMLElement>('[data-date]');
        for (const cell of cells) {
          const cr = cell.getBoundingClientRect();
          if (cr.top <= center && cr.bottom >= center) {
            const date = cell.dataset.date!;
            setVisibleMonth(date.slice(0, 7));
            return;
          }
        }
      });
    }
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  function jumpToToday() {
    scrollTo(today);
  }

  const todoMap = calendarTodosByDate(todos);
  const [visYear, visMonth] = visibleMonth.split('-').map(Number);
  const monthLabel = `${visYear}年${visMonth}月`;

  const isMobile = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => isMobileUA() || window.innerWidth < 640,
    () => false,
  );

  return (
    <div
      className="flex flex-col"
      style={{
        height: isMobile
          ? 'calc(100dvh - 60px - env(safe-area-inset-bottom))'
          : '100dvh',
      }}
    >
      {/* PC ヘッダー (モバイルは MobileShell の bottom tab で代替) */}
      {!isMobile && (
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <h1 className="mr-auto text-lg font-semibold">📅 カレンダー</h1>
          <Link
            href="/"
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            タイムボクシング
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
          >
            ⚙️
          </button>
        </header>
      )}

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white text-center text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={clsx(
              'py-2',
              i === 0 && 'text-red-600 dark:text-red-400',
              i === 6 && 'text-blue-600 dark:text-blue-400',
              i !== 0 && i !== 6 && 'text-slate-700 dark:text-slate-200',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const d = parseDate(date);
            const dow = d.getDay();
            const dateMonth = date.slice(0, 7);
            const isToday = date === today;
            const isVisibleMonth = dateMonth === visibleMonth;
            const isJpHoliday = isJapaneseHoliday(d);

            // Border edges for highlighting visible month boundary
            const aboveDate = formatDate(addDays(d, -7));
            const belowDate = formatDate(addDays(d, 7));
            const leftDate = dow > 0 ? formatDate(addDays(d, -1)) : null;
            const rightDate = dow < 6 ? formatDate(addDays(d, 1)) : null;
            const aboveSame = aboveDate.slice(0, 7) === visibleMonth;
            const belowSame = belowDate.slice(0, 7) === visibleMonth;
            const leftSame = leftDate ? leftDate.slice(0, 7) === visibleMonth : false;
            const rightSame = rightDate ? rightDate.slice(0, 7) === visibleMonth : false;

            const dayEvents = events
              .filter((e) => e.date === date && !e.timetableId)
              .sort((a, b) => a.startMinutes - b.startMinutes);
            const dayTodos = todoMap.get(date) ?? [];
            const items = [
              ...dayTodos.map((t) => ({ kind: 'todo' as const, item: t })),
              ...dayEvents.map((e) => ({ kind: 'event' as const, item: e })),
            ];
            const isFirstOfMonth = d.getDate() === 1;
            const numberLabel = isFirstOfMonth ? `${d.getMonth() + 1}月1日` : String(d.getDate());

            const cell = (
              <div
                key={date}
                data-date={date}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onCellPointerDown(date, e)}
                onPointerMove={onCellPointerMove}
                onPointerUp={onCellPointerEnd}
                onPointerCancel={onCellPointerEnd}
                onClick={() => onCellClick(date)}
                className={clsx(
                  'relative flex min-h-[88px] cursor-pointer flex-col gap-0.5 border-r border-b border-dotted p-1 text-left',
                  isJpHoliday
                    ? 'border-pink-300 dark:border-pink-700'
                    : 'border-slate-200 dark:border-slate-700',
                  isToday && 'bg-yellow-100 dark:bg-yellow-900/30',
                  rangeState.kind === 'pick-end' && rangeState.start === date && 'bg-amber-200 dark:bg-amber-900/50',
                  isVisibleMonth && !aboveSame && (isJpHoliday ? 'border-t-2 border-t-pink-500 dark:border-t-pink-400' : 'border-t-2 border-t-slate-700 dark:border-t-slate-200'),
                  isVisibleMonth && !belowSame && (isJpHoliday ? 'border-b-2 border-b-pink-500 dark:border-b-pink-400' : 'border-b-2 border-b-slate-700 dark:border-b-slate-200'),
                  isVisibleMonth && (!leftSame || dow === 0) && (isJpHoliday ? 'border-l-2 border-l-pink-500 dark:border-l-pink-400' : 'border-l-2 border-l-slate-700 dark:border-l-slate-200'),
                  isVisibleMonth && (!rightSame || dow === 6) && (isJpHoliday ? 'border-r-2 border-r-pink-500 dark:border-r-pink-400' : 'border-r-2 border-r-slate-700 dark:border-r-slate-200'),
                )}
              >
                <div
                  className={clsx(
                    'text-[11px] font-semibold',
                    isJpHoliday && 'text-red-600 dark:text-red-400',
                    !isJpHoliday && dow === 0 && 'text-red-600 dark:text-red-400',
                    !isJpHoliday && dow === 6 && 'text-blue-600 dark:text-blue-400',
                    !isJpHoliday && dow !== 0 && dow !== 6 && 'text-slate-800 dark:text-slate-100',
                    !isVisibleMonth && 'opacity-60',
                  )}
                >
                  {numberLabel}
                </div>
                {items.slice(0, 3).map((it) => {
                  if (it.kind === 'todo') {
                    return (
                      <div
                        key={`t-${it.item.id}`}
                        className="truncate rounded-sm bg-rose-100 px-1 text-[10px] leading-snug text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                      >
                        {todoIcon(it.item.title)}
                        {it.item.title}
                      </div>
                    );
                  }
                  const ev = it.item;
                  return (
                    <button
                      key={`e-${ev.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditEvent(ev);
                      }}
                      className={clsx(
                        'truncate rounded-sm px-1 text-left text-[10px] leading-snug',
                        ev.tentative
                          ? CATEGORY_STYLES[ev.category].chipTentative
                          : CATEGORY_STYLES[ev.category].chip,
                      )}
                    >
                      {ev.title}
                    </button>
                  );
                })}
                {items.length > 3 && (
                  <div className="text-[9px] text-slate-400">+{items.length - 3}</div>
                )}
              </div>
            );
            return cell;
          })}
        </div>
        <div className="h-32" />
      </div>

      {/* 範囲選択モード時のバナー */}
      {rangeState.kind !== 'off' && (
        <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="flex-1">
            {rangeState.kind === 'pick-start'
              ? '↔ 範囲予定: 開始日のセルをタップしてください'
              : `↔ 開始: ${rangeState.start} → 終了日のセルをタップ`}
          </span>
          <button
            type="button"
            onClick={() => setRangeState({ kind: 'off' })}
            className="rounded border border-amber-400 px-2 py-0.5 text-[11px] hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* Sub-toolbar: jump-to-today + visible month + quick add + range */}
      <div className="grid grid-cols-[1fr_2fr_1fr_1fr] items-center gap-1 border-t border-slate-200 bg-emerald-100 px-3 py-2 dark:border-slate-700 dark:bg-emerald-900/40">
        <button
          type="button"
          onClick={jumpToToday}
          className="rounded-md py-2 text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          今日
        </button>
        <div className="text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(today)}
          className="flex items-center justify-center rounded-md py-2 text-2xl font-bold text-slate-800 dark:text-slate-100"
          aria-label="単発追加"
          title="単発追加"
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() =>
            setRangeState((s) => (s.kind === 'off' ? { kind: 'pick-start' } : { kind: 'off' }))
          }
          className={clsx(
            'flex items-center justify-center rounded-md py-2 text-lg font-bold',
            rangeState.kind !== 'off'
              ? 'bg-amber-500 text-white'
              : 'text-slate-800 dark:text-slate-100',
          )}
          aria-label="範囲追加"
          title="範囲予定 (合宿・旅行など)"
        >
          ↔
        </button>
      </div>

      <QuickAddDialog
        open={addOpen !== null}
        date={addOpen ?? today}
        onClose={() => setAddOpen(null)}
      />
      <RangeAddDialog
        open={rangeDialog !== null}
        startDate={rangeDialog?.start ?? today}
        endDate={rangeDialog?.end ?? today}
        onClose={() => setRangeDialog(null)}
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
