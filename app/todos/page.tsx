'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import TodoSidebar from '@/components/todo/TodoSidebar';

export default function TodosPage() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">✅ ToDo</h1>
        <Link
          href="/calendar"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          カレンダー
        </Link>
        <Link
          href="/"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          タイムボクシング
        </Link>
      </header>

      <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        {hydrated ? (
          <TodoSidebar />
        ) : (
          <div className="text-slate-500">読み込み中...</div>
        )}
      </div>
    </main>
  );
}
