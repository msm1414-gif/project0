export interface Semester {
  key: 'spring' | 'fall';
  label: string;
  ranges: { start: string; end: string }[];
}

export function springSemester(year: number): Semester {
  return {
    key: 'spring',
    label: `春学期 ${year}`,
    ranges: [{ start: `${year}-04-06`, end: `${year}-07-30` }],
  };
}

export function fallSemester(year: number): Semester {
  return {
    key: 'fall',
    label: `秋学期 ${year}`,
    ranges: [
      { start: `${year}-10-01`, end: `${year}-12-29` },
      { start: `${year + 1}-01-04`, end: `${year + 1}-02-04` },
    ],
  };
}

export function defaultSemesterYear(now = new Date()): { spring: number; fall: number } {
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  return {
    spring: m >= 9 ? y + 1 : y,
    fall: m >= 9 || m <= 2 ? (m >= 9 ? y : y - 1) : y,
  };
}

export const PERIOD_TIMES: { period: number; start: number; end: number }[] = [
  { period: 1, start: 8 * 60 + 30, end: 10 * 60 },
  { period: 2, start: 10 * 60 + 25, end: 11 * 60 + 55 },
  { period: 3, start: 13 * 60 + 15, end: 14 * 60 + 45 },
  { period: 4, start: 15 * 60 + 10, end: 16 * 60 + 40 },
  { period: 5, start: 17 * 60 + 5, end: 18 * 60 + 35 },
];
