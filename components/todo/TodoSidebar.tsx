'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useApp } from '@/lib/store';

export default function TodoSidebar() {
  const todos = useApp((s) => s.todos);
  const addTodo = useApp((s) => s.addTodo);
  const toggleTodo = useApp((s) => s.toggleTodo);
  const removeTodo = useApp((s) => s.removeTodo);
  const [draft, setDraft] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    addTodo(t);
    setDraft('');
  }

  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);

  return (
    <aside className="flex flex-col gap-3 text-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">ToDo</h2>
        <span className="text-xs text-slate-500">
          {todos.filter((t) => !t.done).length} 件未完了
        </span>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="新しいタスク"
          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          disabled={!draft.trim()}
        >
          追加
        </button>
      </form>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {sorted.length === 0 && (
          <li className="rounded border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
            タスクはまだありません
          </li>
        )}
        {sorted.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <input
              id={`todo-${t.id}`}
              type="checkbox"
              checked={t.done}
              onChange={() => toggleTodo(t.id)}
              className="h-4 w-4 cursor-pointer accent-slate-700"
            />
            <label
              htmlFor={`todo-${t.id}`}
              className={clsx(
                'flex-1 cursor-pointer truncate',
                t.done && 'text-slate-400 line-through',
              )}
            >
              {t.title}
            </label>
            <button
              type="button"
              onClick={() => removeTodo(t.id)}
              className="opacity-0 transition group-hover:opacity-100 text-xs text-slate-400 hover:text-red-500"
              aria-label="削除"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
