'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import SettingsDialog from '@/components/settings/SettingsDialog';
import { todayStr } from '@/lib/time';
import {
  CalendarIcon,
  CalendarTodayIcon,
  CalendarWeekIcon,
  CheckSquareIcon,
  SettingsIcon,
} from '@/components/ui/Icon';

export default function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mobile-shell-pad">{children}</div>
      <BottomTabBar />
    </>
  );
}

function BottomTabBar() {
  const pathname = usePathname() ?? '/';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const today = todayStr();

  const tabs = [
    {
      key: 'cal',
      Icon: CalendarIcon,
      label: '月',
      href: '/calendar',
      active: pathname === '/calendar',
    },
    {
      key: 'week',
      Icon: CalendarWeekIcon,
      label: '週',
      href: '/week',
      active: pathname.startsWith('/week'),
    },
    {
      key: 'today',
      Icon: CalendarTodayIcon,
      label: '今日',
      href: `/?date=${today}`,
      active: pathname === '/',
    },
    {
      key: 'todo',
      Icon: CheckSquareIcon,
      label: 'ToDo',
      href: '/todos',
      active: pathname.startsWith('/todos'),
    },
  ] as const;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--bg-elev)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-elev)]/80 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            prefetch={false}
            className="group flex items-center justify-center py-2 outline-none"
          >
            <TabContent active={t.active} label={t.label}>
              <t.Icon size={20} />
            </TabContent>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="group flex items-center justify-center py-2 outline-none"
        >
          <TabContent active={false} label="設定">
            <SettingsIcon size={20} />
          </TabContent>
        </button>
      </nav>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function TabContent({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-0.5 rounded-full px-1.5 py-1 transition-colors',
        active
          ? 'text-[var(--fg)]'
          : 'text-[var(--fg-muted)] group-hover:text-[var(--fg)]',
      )}
    >
      <span
        className={clsx(
          'flex h-7 w-11 items-center justify-center rounded-full transition-all',
          active && 'bg-[var(--bg-muted)]',
        )}
      >
        {children}
      </span>
      <span className={clsx('text-[10px] leading-none', active && 'font-medium')}>
        {label}
      </span>
    </div>
  );
}
