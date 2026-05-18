'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { addDays, startOfWeek } from 'date-fns';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { formatDate, formatMinutes, parseDate, todayStr } from '@/lib/time';
import { calendarTodosByDate, todoIcon } from '@/lib/todo-calendar';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  anchor: string;
}

export default function WeekView({ anchor }: Props) {
  const events = useApp((s) => s.events);
  const todos = useApp((s) => s.todos);
  const weekStart = startOfWeek(parseDate(anchor), { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => formatDate(addDays(weekStart, i)));
  const todoMap = calendarTodosByDate(todos);
  const today = todayStr();

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((date, i) => {
        const dayEvents = events
          .filter((e) => e.date === date && !e.timetableId)
          .sort((a, b) => a.startMinutes - b.startMinutes);
        const dayTodos = todoMap.get(date) ?? [];
        const dateObj = parseDate(date);
        const isToday = date === today;
        return (
          <Link
            key={date}
            href={{ pathname: '/', query: { date } }}
            className={clsx(
              'flex min-h-[160px] flex-col rounded-md border bg-white p-2 transition hover:border-slate-400 dark:bg-slate-900',
              isToday
                ? 'border-sky-400 ring-1 ring-sky-200 dark:ring-sky-800'
                : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <div className="flex flex-col items-center">
              <div className="text-[11px] text-slate-500">{WEEKDAYS[i]}</div>
              <div
                className={clsx(
                  'text-sm font-semibold',
                  isToday &&
                    'flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white',
                )}
              >
                {dateObj.getDate()}
              </div>
            </div>
            {dayTodos.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
                {dayTodos.map((t) => (
                  <li
                    key={t.id}
                    className="truncate rounded bg-rose-100 px-1 py-0.5 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                  >
                    {todoIcon(t.title)} {t.title}
                  </li>
                ))}
              </ul>
            )}
            <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
              {dayEvents.length === 0 && dayTodos.length === 0 && (
                <li className="text-slate-300 dark:text-slate-600">—</li>
              )}
              {dayEvents.map((e) => (
                <li
                  key={e.id}
                  className={clsx(
                    'flex items-center gap-1 truncate',
                    e.tentative && 'italic opacity-70',
                  )}
                >
                  <span
                    className={clsx(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      e.tentative ? `${CATEGORY_STYLES[e.category].dot} opacity-50` : CATEGORY_STYLES[e.category].dot,
                    )}
                  />
                  <span className="text-slate-500">{formatMinutes(e.startMinutes)}</span>
                  <span
                    className={clsx(
                      'truncate',
                      e.tentative
                        ? 'text-slate-600 underline decoration-dashed dark:text-slate-400'
                        : 'text-slate-900 dark:text-slate-100',
                    )}
                  >
                    {e.title}
                  </span>
                </li>
              ))}
            </ul>
          </Link>
        );
      })}
    </div>
  );
}
