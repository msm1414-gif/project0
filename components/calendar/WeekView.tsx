'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { addDays, startOfWeek } from 'date-fns';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { formatDate, formatMinutes, parseDate, todayStr } from '@/lib/time';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  anchor: string;
}

export default function WeekView({ anchor }: Props) {
  const events = useApp((s) => s.events);
  const weekStart = startOfWeek(parseDate(anchor), { weekStartsOn: 0 });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => formatDate(addDays(weekStart, i))),
    [weekStart],
  );

  const today = todayStr();

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((date, i) => {
        const dayEvents = events
          .filter((e) => e.date === date)
          .sort((a, b) => a.startMinutes - b.startMinutes);
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
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] text-slate-500">{WEEKDAYS[i]}</div>
              <div
                className={clsx(
                  'text-sm font-semibold',
                  isToday && 'text-sky-600 dark:text-sky-400',
                )}
              >
                {dateObj.getDate()}
              </div>
            </div>
            <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
              {dayEvents.length === 0 && (
                <li className="text-slate-300 dark:text-slate-600">—</li>
              )}
              {dayEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-1 truncate">
                  <span
                    className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', CATEGORY_STYLES[e.category].dot)}
                  />
                  <span className="text-slate-500">{formatMinutes(e.startMinutes)}</span>
                  <span className="truncate text-slate-900 dark:text-slate-100">{e.title}</span>
                </li>
              ))}
            </ul>
          </Link>
        );
      })}
    </div>
  );
}
