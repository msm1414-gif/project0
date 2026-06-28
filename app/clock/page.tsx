'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/lib/store';
import { loadSettings, saveSettings } from '@/lib/settings';
import { formatMinutes } from '@/lib/time';
import { CATEGORY_STYLES } from '@/lib/colors';
import type { Event } from '@/lib/types';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface NowState {
  hours: number;
  minutes: number;
  seconds: number;
  dateStr: string;
  dow: number;
  totalMinutes: number;
}

function getNow(): NowState {
  const d = new Date();
  return {
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
    dateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    dow: d.getDay(),
    totalMinutes: d.getHours() * 60 + d.getMinutes(),
  };
}

function ClockInner() {
  const sp = useSearchParams();
  const tokenFromUrl = sp.get('t');

  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const pullNow = useApp((s) => s.pullNow);
  const events = useApp((s) => s.events);

  useEffect(() => {
    if (!tokenFromUrl || !TOKEN_RE.test(tokenFromUrl)) return;
    if (loadSettings().shareToken === tokenFromUrl) return;
    saveSettings({ shareToken: tokenFromUrl });
    void pullNow();
  }, [tokenFromUrl, pullNow]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Refresh cloud snapshot every 5 minutes so the widget doesn't drift
  useEffect(() => {
    const id = setInterval(() => {
      void pullNow().catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [pullNow]);

  const [now, setNow] = useState<NowState>(() => getNow());
  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayEvents = events
    .filter((e) => e.date === now.dateStr && !e.allDay)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const current = todayEvents.find(
    (e) => e.startMinutes <= now.totalMinutes && now.totalMinutes < e.endMinutes,
  );
  const next = todayEvents.find((e) => e.startMinutes > now.totalMinutes);

  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100 antialiased"
      style={{ fontFeatureSettings: '"tnum"' }}
    >
      <section className="flex flex-col items-center justify-center gap-1 px-6 pt-6 pb-3">
        <div className="text-6xl font-light leading-none tracking-tight tabular-nums">
          {pad(now.hours)}
          <span className="opacity-60">:</span>
          {pad(now.minutes)}
          <span className="ml-1 text-2xl text-zinc-500">:{pad(now.seconds)}</span>
        </div>
        <div className="text-xs text-zinc-400 tabular-nums">
          {now.dateStr.replace(/-/g, '.')} ({WEEKDAYS[now.dow]})
        </div>
      </section>

      <div className="mx-6 my-1 h-px bg-zinc-800/80" />

      <section className="px-6 py-3">
        {!hydrated ? (
          <div className="text-xs text-zinc-500">読み込み中…</div>
        ) : current ? (
          <CurrentBlock event={current} nowMin={now.totalMinutes} />
        ) : (
          <FreeBlock nextEvent={next} nowMin={now.totalMinutes} />
        )}
      </section>

      {current && (
        <section className="border-t border-zinc-800/80 px-6 py-3">
          <NextBlock event={next} nowMin={now.totalMinutes} />
        </section>
      )}

      <footer className="mt-auto px-6 py-2 text-[10px] text-zinc-600 tabular-nums">
        {todayEvents.length === 0 && hydrated ? '今日は予定なし' : `今日: ${todayEvents.length} 件`}
      </footer>
    </main>
  );
}

function CurrentBlock({ event, nowMin }: { event: Event; nowMin: number }) {
  const total = Math.max(1, event.endMinutes - event.startMinutes);
  const elapsed = Math.max(0, nowMin - event.startMinutes);
  const remaining = Math.max(0, event.endMinutes - nowMin);
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  const cat = CATEGORY_STYLES[event.category];

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${cat.swatch}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          進行中
        </span>
        <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
          {formatMinutes(event.startMinutes)} – {formatMinutes(event.endMinutes)}
        </span>
      </div>
      <div className="mt-1.5 truncate text-2xl font-semibold leading-tight">
        {event.title || '(無題)'}
      </div>
      {event.notes && (
        <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{event.notes}</div>
      )}
      <div className="mt-3">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear ${cat.swatch}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between text-xs text-zinc-400 tabular-nums">
          <span>
            残り <span className="text-base font-semibold text-zinc-50">{remaining}</span> 分
          </span>
          <span>{Math.round(pct)}% 経過</span>
        </div>
      </div>
    </div>
  );
}

function NextBlock({ event, nowMin }: { event: Event | undefined; nowMin: number }) {
  if (!event) {
    return <div className="text-xs text-zinc-500">この後の予定はなし</div>;
  }
  const until = Math.max(0, event.startMinutes - nowMin);
  const cat = CATEGORY_STYLES[event.category];
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${cat.swatch}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          次の予定
        </span>
        <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
          {formatMinutes(event.startMinutes)} – {formatMinutes(event.endMinutes)}
        </span>
      </div>
      <div className="mt-1.5 truncate text-base font-medium leading-tight">
        {event.title || '(無題)'}
      </div>
      <div className="mt-0.5 text-xs text-zinc-400 tabular-nums">
        あと <span className="text-sm font-semibold text-zinc-50">{until}</span> 分で開始
      </div>
    </div>
  );
}

function FreeBlock({
  nextEvent,
  nowMin,
}: {
  nextEvent: Event | undefined;
  nowMin: number;
}) {
  if (!nextEvent) {
    return (
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">
          空き時間
        </div>
        <div className="mt-1.5 text-2xl font-semibold leading-tight">予定なし</div>
        <div className="mt-0.5 text-xs text-zinc-500">今日は休息日</div>
      </div>
    );
  }
  const until = Math.max(0, nextEvent.startMinutes - nowMin);
  const cat = CATEGORY_STYLES[nextEvent.category];
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${cat.swatch}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">
          空き時間
        </span>
        <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
          次: {formatMinutes(nextEvent.startMinutes)}
        </span>
      </div>
      <div className="mt-1.5 truncate text-lg font-medium leading-tight">
        {nextEvent.title || '(無題)'}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        あと <span className="text-emerald-300">{until}</span> 分
      </div>
    </div>
  );
}

export default function ClockPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-500">
          読み込み中…
        </div>
      }
    >
      <ClockInner />
    </Suspense>
  );
}
