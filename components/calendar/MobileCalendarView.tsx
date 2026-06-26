'use client';

import { useEffect, useRef, useState } from 'react';
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
import {
  ArrowLeftRightIcon,
  BookOpenIcon,
  CloseIcon,
  PlusIcon,
  SettingsIcon,
} from '@/components/ui/Icon';
import ViewSwitcher from '@/components/ui/ViewSwitcher';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const RANGE_BEFORE_MONTHS = 6;
const RANGE_AFTER_MONTHS = 12;

export default function MobileCalendarView() {
  const events = useApp((s) => s.events);
  const todos = useApp((s) => s.todos);

  const today = todayStr();
  const todayDate = parseDate(today);

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
    if (rangeState.kind !== 'off') return;
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

  useEffect(() => {
    scrollTo(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="viewport-with-tab flex flex-col">
      {/* PC ヘッダー (≥640px) — モバイルは下部タブで月/週/今日を切替 */}
      <header className="hidden items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elev)] px-5 py-3 sm:flex">
        <h1 className="mr-auto text-lg font-semibold tracking-tight">カレンダー</h1>
        <ViewSwitcher active="month" />
        <Link
          href="/subjects"
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <BookOpenIcon size={14} />
          科目
        </Link>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
          aria-label="設定"
        >
          <SettingsIcon size={15} />
        </button>
      </header>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--bg-elev)] text-center text-[11px] font-medium uppercase tracking-wide">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={clsx(
              'py-2.5',
              i === 0 && 'text-rose-500',
              i === 6 && 'text-sky-500',
              i !== 0 && i !== 6 && 'text-[var(--fg-muted)]',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain bg-[var(--bg)]">
        <div className="grid grid-cols-7">
          {days.map((date) => {
            const d = parseDate(date);
            const dow = d.getDay();
            const dateMonth = date.slice(0, 7);
            const isToday = date === today;
            const isVisibleMonth = dateMonth === visibleMonth;
            const isJpHoliday = isJapaneseHoliday(d);

            const aboveDate = formatDate(addDays(d, -7));
            const belowDate = formatDate(addDays(d, 7));
            const aboveSame = aboveDate.slice(0, 7) === visibleMonth;
            const belowSame = belowDate.slice(0, 7) === visibleMonth;

            const dayEvents = events
              .filter((e) => e.date === date && !e.timetableId)
              .sort((a, b) => a.startMinutes - b.startMinutes);
            const dayTodos = todoMap.get(date) ?? [];
            const items = [
              ...dayTodos.map((t) => ({ kind: 'todo' as const, item: t })),
              ...dayEvents.map((e) => ({ kind: 'event' as const, item: e })),
            ];
            const isFirstOfMonth = d.getDate() === 1;
            const isPickEndStart =
              rangeState.kind === 'pick-end' && rangeState.start === date;

            return (
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
                  'relative flex min-h-[92px] cursor-pointer flex-col gap-0.5 border-r border-b border-[var(--border)] p-1.5 text-left transition-colors',
                  // Soft tint differences (visible month vs adjacent)
                  !isVisibleMonth && 'bg-[var(--bg)]',
                  isVisibleMonth && !isJpHoliday && 'bg-[var(--bg-elev)]',
                  isJpHoliday && 'bg-rose-50/60 dark:bg-rose-500/10',
                  isPickEndStart && 'bg-amber-100/70 dark:bg-amber-500/20',
                  // Top border of visible month — accent line
                  isVisibleMonth && !aboveSame && 'border-t-2 border-t-[var(--fg)]',
                  isVisibleMonth && !belowSame && 'border-b-2 border-b-[var(--fg)]',
                )}
              >
                <div className="flex items-center gap-1">
                  {isFirstOfMonth && (
                    <span className="tabular text-[9px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
                      {d.getMonth() + 1}月
                    </span>
                  )}
                  <span
                    className={clsx(
                      'tabular flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                      isToday && 'bg-[var(--fg)] text-[var(--bg)]',
                      !isToday && isJpHoliday && 'text-rose-600 dark:text-rose-400',
                      !isToday && !isJpHoliday && dow === 0 && 'text-rose-500',
                      !isToday && !isJpHoliday && dow === 6 && 'text-sky-500',
                      !isToday &&
                        !isJpHoliday &&
                        dow !== 0 &&
                        dow !== 6 &&
                        'text-[var(--fg)]',
                      !isVisibleMonth && !isToday && 'opacity-40',
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                {items.slice(0, 3).map((it) => {
                  if (it.kind === 'todo') {
                    return (
                      <div
                        key={`t-${it.item.id}`}
                        className="truncate rounded px-1 text-[10px] leading-snug bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30"
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
                        'truncate rounded px-1 text-left text-[10px] leading-snug',
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
                  <div className="text-[9px] text-[var(--fg-subtle)]">+{items.length - 3}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-32" />
      </div>

      {/* 範囲選択モード時のバナー */}
      {rangeState.kind !== 'off' && (
        <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          <ArrowLeftRightIcon size={14} />
          <span className="flex-1">
            {rangeState.kind === 'pick-start'
              ? '範囲予定: 開始日のセルをタップ'
              : `開始: ${rangeState.start} → 終了日のセルをタップ`}
          </span>
          <button
            type="button"
            onClick={() => setRangeState({ kind: 'off' })}
            className="flex items-center gap-1 rounded-full border border-amber-400/60 px-2.5 py-0.5 text-[11px] hover:bg-amber-100 dark:hover:bg-amber-500/25"
          >
            <CloseIcon size={11} />
            キャンセル
          </button>
        </div>
      )}

      {/* Sub-toolbar — 表示中の月ラベルと追加系操作。今日/週への切替は下部タブで */}
      <div className="grid grid-cols-[2fr_1fr_1fr] items-center gap-1 border-t border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2">
        <button
          type="button"
          onClick={jumpToToday}
          className="tabular flex h-9 items-center justify-center rounded-full text-sm font-semibold tracking-tight text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          title="現在月までスクロール"
        >
          {monthLabel}
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(today)}
          className="flex h-9 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]"
          aria-label="単発追加"
          title="単発追加"
        >
          <PlusIcon size={20} />
        </button>
        <button
          type="button"
          onClick={() =>
            setRangeState((s) => (s.kind === 'off' ? { kind: 'pick-start' } : { kind: 'off' }))
          }
          className={clsx(
            'flex h-9 items-center justify-center rounded-full',
            rangeState.kind !== 'off'
              ? 'bg-amber-500 text-white'
              : 'text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]',
          )}
          aria-label="範囲追加"
          title="範囲予定 (合宿・旅行など)"
        >
          <ArrowLeftRightIcon size={18} />
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
