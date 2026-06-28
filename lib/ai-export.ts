import type { Event, Timetable, Todo } from './types';
import { CATEGORY_LABELS } from './types';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const PERIOD_TIMES: { period: number; label: string }[] = [
  { period: 1, label: '08:30-10:00' },
  { period: 2, label: '10:25-11:55' },
  { period: 3, label: '13:15-14:45' },
  { period: 4, label: '15:10-16:40' },
  { period: 5, label: '17:05-18:35' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateJP(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatMinutes(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function isoJST(d: Date): string {
  // Render the instant in JST so the AI sees a clear "wall clock" time.
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = parseDateLocal(fromIso);
  const b = parseDateLocal(toIso);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function formatEventLine(ev: Event): string {
  const start = formatMinutes(ev.startMinutes);
  const end = formatMinutes(ev.endMinutes);
  const cat = CATEGORY_LABELS[ev.category];
  const tags: string[] = [`[${cat}]`];
  if (ev.tentative) tags.push('(仮置き)');
  if (ev.timetableId) tags.push('(時間割)');
  const head = `- **${start}–${end}** ${ev.title || '(無題)'} ${tags.join(' ')}`;
  if (!ev.notes) return head;
  const notes = ev.notes.split('\n').map((l) => l.trim()).filter(Boolean).join(' / ');
  return `${head}\n  - メモ: ${notes}`;
}

function dayBlock(date: Date, events: Event[]): string[] {
  const iso = formatDateJP(date);
  const dow = WEEKDAYS[date.getDay()];
  const items = events
    .filter((e) => e.date === iso && !e.allDay)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const lines = [`### ${iso} (${dow})`];
  if (items.length === 0) {
    lines.push('(予定なし)');
  } else {
    for (const ev of items) lines.push(formatEventLine(ev));
  }
  lines.push('');
  return lines;
}

interface Input {
  events: Event[];
  todos: Todo[];
  timetables: Timetable[];
  now: Date;
}

export function generateAiMarkdown({ events, todos, timetables, now }: Input): string {
  const today = formatDateJP(now);
  const todayDow = WEEKDAYS[now.getDay()];

  const lines: string[] = [];

  lines.push('# Timebox Calendar — AI 用エクスポート');
  lines.push('');
  lines.push(
    'このページは AI (Claude等) が読みやすいよう Markdown でまとめた、ユーザーの予定・ToDo・時間割のスナップショットです。',
  );
  lines.push('日付は `YYYY-MM-DD`、時刻は 24h `HH:MM` (JST)。週は日曜始まり。');
  lines.push('');
  lines.push(`- 取得日時: ${isoJST(now)}`);
  lines.push(`- 今日: ${today} (${todayDow})`);
  lines.push(`- 件数: 予定 ${events.length} 件 / ToDo ${todos.length} 件 / 時間割 ${timetables.length} 件`);
  lines.push('');

  // ── 時間割 (最も最近更新されたもの)
  const latestTt = [...timetables].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (latestTt) {
    lines.push('---');
    lines.push('');
    const sem = latestTt.semesterKey === 'spring' ? '春学期' : '秋学期';
    lines.push(`## 時間割 (${sem} ${latestTt.year})`);
    lines.push('');
    const days = latestTt.includeSat ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
    lines.push(`| 時限 (時間) | ${days.map((d) => WEEKDAYS[d]).join(' | ')} |`);
    lines.push(`| --- | ${days.map(() => '---').join(' | ')} |`);
    for (const p of PERIOD_TIMES) {
      const row = [`${p.period}限 (${p.label})`];
      for (const day of days) {
        const cell = latestTt.cells.find((c) => c.day === day && c.period === p.period);
        row.push(cell?.subject || '–');
      }
      lines.push(`| ${row.join(' | ')} |`);
    }
    lines.push('');
    if (timetables.length > 1) {
      lines.push(
        `(他に ${timetables.length - 1} 件の時間割が保存されています。最新のものを上に表示)`,
      );
      lines.push('');
    }
  }

  // ── 今日の予定
  lines.push('---');
  lines.push('');
  lines.push(`## 今日の予定 (${today} ${todayDow})`);
  lines.push('');
  const todayEvents = events
    .filter((e) => e.date === today && !e.allDay)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  if (todayEvents.length === 0) {
    lines.push('(予定なし)');
  } else {
    for (const ev of todayEvents) lines.push(formatEventLine(ev));
  }
  lines.push('');

  // ── 今後7日間
  lines.push('---');
  lines.push('');
  lines.push('## 今後 7 日間の予定 (明日から)');
  lines.push('');
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    for (const l of dayBlock(d, events)) lines.push(l);
  }

  // ── 過去7日間
  lines.push('---');
  lines.push('');
  lines.push('## 過去 7 日間の予定 (参考)');
  lines.push('');
  for (let i = 7; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    for (const l of dayBlock(d, events)) lines.push(l);
  }

  // ── 範囲予定 (allDay)
  const rangeEventsAll = events.filter((e) => e.allDay);
  if (rangeEventsAll.length > 0) {
    // Group by recurringGroupId so multi-day blocks collapse
    const groups = new Map<string, Event[]>();
    for (const ev of rangeEventsAll) {
      const key = ev.recurringGroupId ?? ev.id;
      const arr = groups.get(key) ?? [];
      arr.push(ev);
      groups.set(key, arr);
    }
    const upcoming: { start: string; end: string; days: number; title: string; cat: string }[] = [];
    const past: typeof upcoming = [];
    for (const evs of groups.values()) {
      const sorted = evs.sort((a, b) => a.date.localeCompare(b.date));
      const start = sorted[0].date;
      const end = sorted[sorted.length - 1].date;
      const entry = {
        start,
        end,
        days: sorted.length,
        title: sorted[0].title || '(無題)',
        cat: CATEGORY_LABELS[sorted[0].category],
      };
      if (end >= today) upcoming.push(entry);
      else past.push(entry);
    }
    if (upcoming.length > 0 || past.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## 範囲予定 (合宿・旅行・帰省など終日扱い)');
      lines.push('');
      if (upcoming.length > 0) {
        lines.push('### 進行中 / 今後');
        for (const e of upcoming.sort((a, b) => a.start.localeCompare(b.start))) {
          lines.push(`- ${e.start} 〜 ${e.end} (${e.days}日間): **${e.title}** [${e.cat}]`);
        }
        lines.push('');
      }
      if (past.length > 0) {
        lines.push('### 過去');
        for (const e of past.sort((a, b) => b.start.localeCompare(a.start)).slice(0, 5)) {
          lines.push(`- ${e.start} 〜 ${e.end} (${e.days}日間): ${e.title} [${e.cat}]`);
        }
        lines.push('');
      }
    }
  }

  // ── ToDo
  lines.push('---');
  lines.push('');
  lines.push('## ToDo');
  lines.push('');
  const pending = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return b.createdAt - a.createdAt;
    });
  if (pending.length === 0) {
    lines.push('(未完了タスクなし)');
    lines.push('');
  } else {
    lines.push(`### 未完了 (${pending.length}件、期限が近い順)`);
    lines.push('');
    for (const t of pending) {
      if (t.deadline) {
        const d = daysBetween(today, t.deadline);
        let label: string;
        if (d === 0) label = '今日まで';
        else if (d === 1) label = '明日まで';
        else if (d > 1) label = `あと${d}日`;
        else if (d === -1) label = '昨日が期限';
        else label = `${-d}日超過`;
        lines.push(`- [ ] **${t.deadline} (${label})** — ${t.title}`);
      } else {
        lines.push(`- [ ] (期限なし) — ${t.title}`);
      }
    }
    lines.push('');
  }
  const completed = todos
    .filter((t) => t.done)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);
  if (completed.length > 0) {
    lines.push('### 完了済み (直近10件)');
    lines.push('');
    for (const t of completed) {
      lines.push(`- [x] ${t.title}`);
    }
    lines.push('');
  }

  // ── 凡例
  lines.push('---');
  lines.push('');
  lines.push('## 凡例');
  lines.push('');
  lines.push('- **カテゴリ**: 大学 / バイト / サークル / 遊び / その他');
  lines.push('- **(仮置き)**: ユーザーがまだ確定していない予定');
  lines.push('- **(時間割)**: 時間割から自動生成された予定 (定期授業)');
  lines.push('- **範囲予定**: 終日扱いの複数日にまたがる予定 (合宿、旅行など)');
  lines.push('- 時間は JST、日付は YYYY-MM-DD 形式、時刻は 24時間 HH:MM 形式');

  return lines.join('\n') + '\n';
}
