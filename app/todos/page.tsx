'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import TodoSidebar from '@/components/todo/TodoSidebar';
import { CalendarIcon, CalendarTodayIcon } from '@/components/ui/Icon';

export default function TodosPage() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">ToDo</h1>
        <Link
          href="/calendar"
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <CalendarIcon size={14} />
          カレンダー
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
        >
          <CalendarTodayIcon size={14} />
          今日
        </Link>
      </header>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 shadow-sm">
        {hydrated ? (
          <TodoSidebar />
        ) : (
          <div className="text-sm text-[var(--fg-muted)]">読み込み中...</div>
        )}
      </div>
    </main>
  );
}
