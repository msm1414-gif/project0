// カレンダー連携。日記Bot は project0 と同じ Next.js アプリ内で動くため、
// HTTP を介さず server-store の getSnapshot を直接呼べる。
// 共有トークン1つ＝1ユーザーの全カレンダー（設計書セクション6）。

import { getSnapshot } from '@/lib/server-store';
import { CATEGORY_LABELS, type Event } from '@/lib/types';

export interface CalendarEvent {
  title: string;
  category: string; // 日本語ラベル（大学/バイト/サークル/遊び/その他）
  date: string; // YYYY-MM-DD
  start: string; // HH:MM、終日予定は ''
  end: string;
  allDay: boolean;
  tentative: boolean;
  notes?: string;
}

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toCalendarEvent(ev: Event): CalendarEvent {
  return {
    title: ev.title,
    category: CATEGORY_LABELS[ev.category],
    date: ev.date,
    start: ev.allDay ? '' : hhmm(ev.startMinutes),
    end: ev.allDay ? '' : hhmm(ev.endMinutes),
    allDay: !!ev.allDay,
    tentative: !!ev.tentative,
    notes: ev.notes,
  };
}

// 指定期間 [fromDate, toDate]（YYYY-MM-DD, 両端含む）の予定を取得。
// スナップショットが無い／古い場合もあるため呼び出し側で空配列を許容すること。
export async function getCalendarEvents(
  shareToken: string,
  fromDate: string,
  toDate: string,
): Promise<CalendarEvent[]> {
  const snap = await getSnapshot(shareToken);
  if (!snap) return [];
  return snap.events
    .filter((ev) => ev.date >= fromDate && ev.date <= toDate)
    .map(toCalendarEvent)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

const JST_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

// YYYY-MM-DD（JST想定）から日本語の曜日1文字を返す。
export function jstWeekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return JST_WEEKDAYS[wd];
}

// 予定を「質問の燃料」としてプロンプトに渡せる文字列に整形する。
// 例: 「06-17(火) 14:00-15:30 ゼミ [大学] ←今日」
export function formatEventsForPrompt(events: CalendarEvent[], todayDate?: string): string {
  if (events.length === 0) return '(この期間の予定なし)';
  return events
    .map((e) => {
      const wd = jstWeekday(e.date);
      const md = e.date.slice(5); // MM-DD
      const when = e.allDay ? '終日' : `${e.start}-${e.end}`;
      const flags = e.tentative ? ' (仮)' : '';
      const notes = e.notes ? ` ※${e.notes}` : '';
      const marker =
        todayDate && e.date === todayDate
          ? ' ←今日'
          : todayDate && e.date === addDays(todayDate, 1)
            ? ' ←明日'
            : '';
      return `${md}(${wd}) ${when} ${e.title} [${e.category}]${flags}${notes}${marker}`;
    })
    .join('\n');
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
