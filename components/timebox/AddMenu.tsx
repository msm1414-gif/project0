'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  RepeatIcon,
  GridIcon,
  ChevronDownIcon,
} from '@/components/ui/Icon';

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
        className="flex items-center gap-1.5 rounded-full bg-[var(--fg)] px-3.5 py-1.5 text-xs font-medium text-[var(--bg)] hover:opacity-90"
      >
        <PlusIcon size={14} />
        <span>追加</span>
        <ChevronDownIcon size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-lg shadow-black/5">
          <MenuItem
            icon={<PencilIcon size={16} />}
            title="新規予定"
            sub="1 件をフォームで追加"
            onClick={() => pick(onQuickAdd)}
          />
          <div className="h-px bg-[var(--border)]" />
          <MenuItem
            icon={<RepeatIcon size={16} />}
            title="一括登録"
            sub="期間 × 曜日で繰り返し"
            onClick={() => pick(onBulkRegister)}
          />
          <div className="h-px bg-[var(--border)]" />
          <MenuItem
            icon={<GridIcon size={16} />}
            title="時間割"
            sub="学期の授業をまとめて"
            onClick={() => pick(onTimetable)}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[var(--bg-soft)]"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--fg-muted)]">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-[var(--fg)]">{title}</span>
        <span className="block text-[11px] text-[var(--fg-muted)]">{sub}</span>
      </span>
    </button>
  );
}
