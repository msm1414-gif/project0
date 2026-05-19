'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import SettingsDialog from '@/components/settings/SettingsDialog';
import { todayStr } from '@/lib/time';

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

const BAR_HEIGHT_PX = 60;

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const isMobile = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => isMobileUA() || window.innerWidth < 640,
    () => false,
  );

  if (!isMobile) return <>{children}</>;

  return (
    <>
      <div
        style={{
          paddingBottom: `calc(${BAR_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
          minHeight: '100dvh',
        }}
      >
        {children}
      </div>
      <BottomTabBar />
    </>
  );
}

function BottomTabBar() {
  const pathname = usePathname() ?? '/';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const today = todayStr();

  const tabs = [
    { key: 'cal', icon: '📅', label: 'カレンダー', href: '/calendar', active: pathname === '/calendar' },
    { key: 'today', icon: '📆', label: '今日', href: `/?date=${today}`, active: pathname === '/' },
    { key: 'subj', icon: '📚', label: '科目', href: '/subjects', active: pathname.startsWith('/subjects') },
  ] as const;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)] dark:border-slate-700 dark:bg-slate-900"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            prefetch={false}
            className={clsx(
              'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]',
              t.active
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-slate-600 dark:text-slate-300',
            )}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className={clsx(t.active && 'font-semibold')}>{t.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-slate-600 dark:text-slate-300"
        >
          <span className="text-lg leading-none">⚙️</span>
          <span>設定</span>
        </button>
      </nav>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
