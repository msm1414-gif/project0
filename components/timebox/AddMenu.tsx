'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onQuickAdd: () => void;
  onBulkRegister: () => void;
  onTimetable: () => void;
}

export default function AddMenu({ onQuickAdd, onBulkRegister, onTimetable }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        + 追加 ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => pick(onQuickAdd)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span>📝</span>
            <div>
              <div>新規予定</div>
              <div className="text-[10px] text-slate-500">1 件をフォームで追加</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => pick(onBulkRegister)}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
          >
            <span>🔁</span>
            <div>
              <div>一括登録</div>
              <div className="text-[10px] text-slate-500">期間 × 曜日で繰り返し</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => pick(onTimetable)}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
          >
            <span>🗓️</span>
            <div>
              <div>時間割</div>
              <div className="text-[10px] text-slate-500">学期の授業をまとめて</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
