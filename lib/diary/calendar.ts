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

// 予定を「質問の燃料」としてプロンプトに渡せる文字列に整形する。
// 例: 「水(05-21) 14:00 プレゼン本番 [大学]」
export function formatEventsForPrompt(events: CalendarEvent[]): string {
  if (events.length === 0) return '(この期間の予定なし)';
  return events
    .map((e) => {
      const when = e.allDay ? '終日' : `${e.start}-${e.end}`;
      const flags = e.tentative ? ' (仮)' : '';
      const notes = e.notes ? ` ※${e.notes}` : '';
      return `${e.date} ${when} ${e.title} [${e.category}]${flags}${notes}`;
    })
    .join('\n');
}
