'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';

export default function SubjectsPage() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const events = useApp((s) => s.events);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const subjects = useMemo(() => {
    const map = new Map<string, { count: number; next?: string; last?: string; notionCount: number }>();
    const todayIso = new Date().toISOString().slice(0, 10);
    for (const ev of events) {
      if (ev.category !== 'university') continue;
      const entry = map.get(ev.title) ?? { count: 0, next: undefined, last: undefined, notionCount: 0 };
      entry.count++;
      if (ev.notionPageUrl) entry.notionCount++;
      if (ev.date >= todayIso && (!entry.next || ev.date < entry.next)) entry.next = ev.date;
      if (!entry.last || ev.date > entry.last) entry.last = ev.date;
      map.set(ev.title, entry);
    }
    return Array.from(map.entries())
      .map(([title, info]) => ({ title, ...info }))
      .sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  }, [events]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">科目一覧</h1>
        <Link
          href="/"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          タイムボクシング
        </Link>
        <Link
          href="/calendar"
          className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          カレンダー
        </Link>
      </header>

      {!hydrated ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          読み込み中...
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          大学カテゴリの予定がまだありません。一括登録で時間割を入れてみてください。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.title}>
              <Link
                href={`/subjects/${encodeURIComponent(s.title)}`}
                className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${CATEGORY_STYLES.university.swatch}`} />
                  <span className="flex-1 truncate font-semibold">{s.title}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <dt>講義数</dt>
                  <dd className="text-right">{s.count}</dd>
                  <dt>次回</dt>
                  <dd className="text-right">{s.next ?? '—'}</dd>
                  <dt>最終</dt>
                  <dd className="text-right">{s.last ?? '—'}</dd>
                  <dt>Notion</dt>
                  <dd className="text-right">
                    {s.notionCount}/{s.count}
                  </dd>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
