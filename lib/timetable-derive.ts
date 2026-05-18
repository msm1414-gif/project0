import { eachDayOfInterval } from 'date-fns';
import type { Event } from './types';
import { PERIOD_TIMES, type Semester } from './semesters';
import { formatDate, parseDate } from './time';

export interface DerivedTimetable {
  cells: Record<string, string>;
  sourceEventIds: Set<string>;
  sourceCount: number;
}

/**
 * Build a provisional timetable grid from existing events whose start/end
 * exactly match a standard period. For each (day-of-week, period) slot, the
 * subject with the most occurrences within the semester wins. Returns the
 * grid plus the ids of every event that contributed (across all subjects
 * for filled slots) so the caller can delete them when the timetable is
 * formally saved.
 */
export function deriveTimetableFromEvents(events: Event[], semester: Semester): DerivedTimetable {
  const datesInSemester = new Set<string>();
  for (const range of semester.ranges) {
    const days = eachDayOfInterval({
      start: parseDate(range.start),
      end: parseDate(range.end),
    });
    for (const d of days) datesInSemester.add(formatDate(d));
  }

  // key "day-period" -> subject title -> { count, ids[] }
  const tally = new Map<string, Map<string, { count: number; ids: string[] }>>();

  for (const ev of events) {
    if (ev.category !== 'university') continue;
    if (!datesInSemester.has(ev.date)) continue;
    const period = PERIOD_TIMES.find(
      (p) => p.start === ev.startMinutes && p.end === ev.endMinutes,
    );
    if (!period) continue;
    const dow = parseDate(ev.date).getDay();
    const key = `${dow}-${period.period}`;
    let subjects = tally.get(key);
    if (!subjects) {
      subjects = new Map();
      tally.set(key, subjects);
    }
    const entry = subjects.get(ev.title) ?? { count: 0, ids: [] };
    entry.count++;
    entry.ids.push(ev.id);
    subjects.set(ev.title, entry);
  }

  const cells: Record<string, string> = {};
  const sourceEventIds = new Set<string>();
  for (const [key, subjects] of tally) {
    let topSubject = '';
    let topCount = 0;
    for (const [subject, entry] of subjects) {
      if (entry.count > topCount) {
        topCount = entry.count;
        topSubject = subject;
      }
    }
    if (topSubject) {
      cells[key] = topSubject;
      for (const entry of subjects.values()) {
        for (const id of entry.ids) sourceEventIds.add(id);
      }
    }
  }
  return { cells, sourceEventIds, sourceCount: sourceEventIds.size };
}
