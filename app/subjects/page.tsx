'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { FileTextIcon } from '@/components/ui/Icon';
import ViewSwitcher from '@/components/ui/ViewSwitcher';

export default function SubjectsPage() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const events = useApp((s) => s.events);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const subjects = useMemo(() => {
    const map = new Map<
      string,
      { count: number; next?: string; last?: string; notionCount: number }
    >();
    const todayIso = new Date().toISOString().slice(0, 10);
    for (const ev of events) {
      if (ev.category !== 'university') continue;
      const entry =
        map.get(ev.title) ?? { count: 0, next: undefined, last: undefined, notionCount: 0 };
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
        <h1 className="mr-auto text-xl font-semibold tracking-tight">科目一覧</h1>
        <ViewSwitcher />
      </header>

      {!hydrated ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--fg-muted)]">
          読み込み中...
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--fg-muted)]">
          大学カテゴリの予定がまだありません。<br />
          一括登録で時間割を入れてみてください。
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.title}>
              <Link
                href={`/subjects/${encodeURIComponent(s.title)}`}
                className="group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLES.university.swatch}`} />
                  <span className="flex-1 truncate font-semibold tracking-tight">{s.title}</span>
                </div>
                <dl className="tabular mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-[var(--fg-muted)]">
                  <dt>講義数</dt>
                  <dd className="text-right text-[var(--fg)]">{s.count}</dd>
                  <dt>次回</dt>
                  <dd className="text-right text-[var(--fg)]">{s.next ?? '—'}</dd>
                  <dt>最終</dt>
                  <dd className="text-right text-[var(--fg)]">{s.last ?? '—'}</dd>
                  <dt className="flex items-center gap-1">
                    <FileTextIcon size={11} />
                    Notion
                  </dt>
                  <dd className="text-right text-[var(--fg)]">
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
