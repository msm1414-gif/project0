'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { formatDate, formatMinutes, parseDate, todayStr } from '@/lib/time';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  anchor: string;
}

export default function MonthView({ anchor }: Props) {
  const events = useApp((s) => s.events);
  const anchorDate = parseDate(anchor);
  const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 });

  const days: string[] = [];
  {
    let cur = gridStart;
    while (cur <= gridEnd) {
      days.push(formatDate(cur));
      cur = addDays(cur, 1);
    }
  }

  const today = todayStr();
  const currentMonth = anchorDate.getMonth();

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const d = parseDate(date);
          const inMonth = d.getMonth() === currentMonth;
          const isToday = date === today;
          const dayEvents = events
            .filter((e) => e.date === date)
            .sort((a, b) => a.startMinutes - b.startMinutes);
          const visible = dayEvents.slice(0, 3);
          const extra = dayEvents.length - visible.length;
          return (
            <Link
              key={date}
              href={{ pathname: '/', query: { date } }}
              className={clsx(
                'flex min-h-[100px] flex-col gap-0.5 border-b border-r border-slate-100 p-1 text-[11px] transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800',
                !inMonth && 'bg-slate-50/50 text-slate-400 dark:bg-slate-900/60 dark:text-slate-600',
              )}
            >
              <div
                className={clsx(
                  'self-center text-[11px] font-semibold',
                  isToday &&
                    'flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white',
                )}
              >
                {d.getDate()}
              </div>
              {visible.map((e) => (
                <div key={e.id} className="flex items-center gap-1 truncate">
                  <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', CATEGORY_STYLES[e.category].dot)} />
                  <span className="text-slate-500">{formatMinutes(e.startMinutes)}</span>
                  <span className="truncate text-slate-900 dark:text-slate-100">{e.title}</span>
                </div>
              ))}
              {extra > 0 && <div className="text-slate-400">+{extra} more</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
