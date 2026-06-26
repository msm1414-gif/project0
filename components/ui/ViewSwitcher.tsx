'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { CalendarIcon, CalendarTodayIcon, CalendarWeekIcon } from './Icon';

type ViewKey = 'today' | 'week' | 'month';

const items: { key: ViewKey; label: string; href: string; Icon: typeof CalendarIcon }[] = [
  { key: 'today', label: '今日', href: '/', Icon: CalendarTodayIcon },
  { key: 'week', label: '週', href: '/week', Icon: CalendarWeekIcon },
  { key: 'month', label: '月', href: '/calendar', Icon: CalendarIcon },
];

export default function ViewSwitcher({ active }: { active?: ViewKey }) {
  return (
    <div className="hidden items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-0.5 shadow-sm sm:flex">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <Link
            key={it.key}
            href={it.href}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-[var(--bg-muted)] text-[var(--fg)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]',
            )}
          >
            <it.Icon size={14} />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
