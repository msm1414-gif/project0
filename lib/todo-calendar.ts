import type { Todo } from './types';

const CALENDAR_KEYWORDS = ['試験', '課題', 'レポート', '提出', 'テスト', 'exam', 'quiz'];

export function isCalendarTodo(todo: Todo): boolean {
  if (!todo.deadline) return false;
  if (todo.done) return false;
  const lower = todo.title.toLowerCase();
  return CALENDAR_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export function calendarTodosByDate(todos: Todo[]): Map<string, Todo[]> {
  const map = new Map<string, Todo[]>();
  for (const t of todos) {
    if (!isCalendarTodo(t)) continue;
    const date = t.deadline!;
    const list = map.get(date) ?? [];
    list.push(t);
    map.set(date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }
  return map;
}

export function todoIcon(title: string): string {
  if (title.includes('試験') || /test|exam|quiz/i.test(title)) return '📝';
  if (title.includes('課題') || title.includes('レポート') || title.includes('提出')) return '📚';
  return '📌';
}
