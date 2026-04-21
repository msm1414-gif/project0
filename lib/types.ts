export type Category = 'university' | 'work' | 'leisure' | 'other';

export const CATEGORIES: Category[] = ['university', 'work', 'leisure', 'other'];

export const CATEGORY_LABELS: Record<Category, string> = {
  university: '大学',
  work: 'バイト',
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
  createdAt: number;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
}
