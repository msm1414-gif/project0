export type Category = 'university' | 'work' | 'circle' | 'leisure' | 'other';

export const CATEGORIES: Category[] = ['university', 'work', 'circle', 'leisure', 'other'];

export const CATEGORY_LABELS: Record<Category, string> = {
  university: '大学',
  work: 'バイト',
  circle: 'サークル',
  leisure: '遊び',
  other: 'その他',
};

export interface Event {
  id: string;
  title: string;
  category: Category;
  date: string;
  startMinutes: number;
  endMinutes: number;
  recurringGroupId?: string;
  timetableId?: string;
  tentative?: boolean;
  allDay?: boolean;
  notes?: string;
  notionPageUrl?: string;
  notionPageId?: string;
  createdAt: number;
}

export interface TimetableCell {
  day: number;
  period: number;
  subject: string;
}

export interface Timetable {
  id: string;
  semesterKey: 'spring' | 'fall';
  year: number;
  excludeHolidays: boolean;
  includeSat: boolean;
  createNotion: boolean;
  cells: TimetableCell[];
  createdAt: number;
  updatedAt: number;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  deadline?: string;
  createdAt: number;
}
