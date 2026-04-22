import type { Event } from './types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toICSDateTimeJST(date: string, minutes: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const h = Math.floor(minutes / 60);
  const mi = minutes % 60;
  const asUTC = new Date(Date.UTC(y, m - 1, d, h, mi));
  asUTC.setUTCHours(asUTC.getUTCHours() - 9);
  const yy = asUTC.getUTCFullYear();
  const mm = pad2(asUTC.getUTCMonth() + 1);
  const dd = pad2(asUTC.getUTCDate());
  const hh = pad2(asUTC.getUTCHours());
  const mn = pad2(asUTC.getUTCMinutes());
  return `${yy}${mm}${dd}T${hh}${mn}00Z`;
}

function nowUTC(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}${pad2(n.getUTCMonth() + 1)}${pad2(n.getUTCDate())}T${pad2(n.getUTCHours())}${pad2(n.getUTCMinutes())}${pad2(n.getUTCSeconds())}Z`;
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function fold(line: string): string {
  const max = 73;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, max - 1));
    rest = rest.slice(max - 1);
  }
  return parts.join('\r\n');
}

export function generateICS(events: Event[], calendarName = 'Timebox'): string {
  const dtstamp = nowUTC();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Timebox//Calendar//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
  ];
  for (const ev of events) {
    if (ev.endMinutes <= ev.startMinutes) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(fold(`UID:${ev.id}@timebox`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${toICSDateTimeJST(ev.date, ev.startMinutes)}`);
    lines.push(`DTEND:${toICSDateTimeJST(ev.date, ev.endMinutes)}`);
    lines.push(fold(`SUMMARY:${esc(ev.title)}`));
    const desc: string[] = [];
    if (ev.notes) desc.push(ev.notes);
    if (ev.notionPageUrl) desc.push(`Notion: ${ev.notionPageUrl}`);
    if (desc.length) lines.push(fold(`DESCRIPTION:${esc(desc.join('\n'))}`));
    if (ev.notionPageUrl) lines.push(fold(`URL:${ev.notionPageUrl}`));
    lines.push(`CATEGORIES:${ev.category}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
