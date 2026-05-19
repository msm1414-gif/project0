'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import MobileCalendarView from '@/components/calendar/MobileCalendarView';
import { useApp } from '@/lib/store';
import { loadSettings, saveSettings } from '@/lib/settings';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

function CalendarInner() {
  const hydrate = useApp((s) => s.hydrate);
  const pullNow = useApp((s) => s.pullNow);
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('t');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!tokenFromUrl || !TOKEN_RE.test(tokenFromUrl)) return;
    if (loadSettings().shareToken === tokenFromUrl) return;
    saveSettings({ shareToken: tokenFromUrl });
    void pullNow();
  }, [tokenFromUrl, pullNow]);

  return <MobileCalendarView />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">読み込み中...</div>}>
      <CalendarInner />
    </Suspense>
  );
}
