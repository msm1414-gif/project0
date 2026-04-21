'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Event } from '@/lib/types';
import { useApp } from '@/lib/store';
import {
  DAY_MINUTES,
  GRID_HEIGHT,
  MIN_EVENT_MINUTES,
  PX_PER_HOUR,
  formatMinutes,
  minutesToPx,
  pxToMinutes,
  snap,
  todayStr,
} from '@/lib/time';
import EventBlock from './EventBlock';
import CurrentTimeLine from './CurrentTimeLine';
import NewEventDialog from './NewEventDialog';

interface Props {
  date: string;
}

type Selection = { startMinutes: number; endMinutes: number };

export default function TimeboxGrid({ date }: Props) {
  const events = useApp((s) => s.events);
  const addEvent = useApp((s) => s.addEvent);
  const updateEvent = useApp((s) => s.updateEvent);
  const removeEvent = useApp((s) => s.removeEvent);
  const removeGroup = useApp((s) => s.removeGroup);

  const gridRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectingRef = useRef<{ anchor: number; pointerId: number } | null>(null);

  const [dialog, setDialog] = useState<
    | { kind: 'new'; initial: Selection }
    | { kind: 'edit'; event: Event }
    | null
  >(null);

  const dayEvents = useMemo(
    () => events.filter((e) => e.date === date).sort((a, b) => a.startMinutes - b.startMinutes),
    [events, date],
  );

  const isToday = date === todayStr();

  function yToMinutes(clientY: number): number {
    const rect = gridRef.current!.getBoundingClientRect();
    return pxToMinutes(clientY - rect.top);
  }

  function onGridPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-event-block]')) return;
    const anchor = snap(yToMinutes(e.clientY));
    selectingRef.current = { anchor, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelection({ startMinutes: anchor, endMinutes: anchor + MIN_EVENT_MINUTES });
  }

  function onGridPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = selectingRef.current;
    if (!s) return;
    const cur = snap(yToMinutes(e.clientY));
    const start = Math.max(0, Math.min(s.anchor, cur));
    const end = Math.min(DAY_MINUTES, Math.max(s.anchor, cur));
    setSelection({
      startMinutes: start,
      endMinutes: Math.max(end, start + MIN_EVENT_MINUTES),
    });
  }

  function onGridPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = selectingRef.current;
    selectingRef.current = null;
    if (!s) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (!selection) return;
    const sel = selection;
    setSelection(null);
    if (sel.endMinutes - sel.startMinutes < MIN_EVENT_MINUTES) return;
    setDialog({ kind: 'new', initial: sel });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDialog(null);
        setSelection(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fivePx = minutesToPx(5);
  const halfPx = minutesToPx(30);
  const hourPx = minutesToPx(60);

  return (
    <div className="relative flex">
      <div className="w-[60px] shrink-0 select-none text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ height: PX_PER_HOUR }} className="relative pr-2">
            {h === 0 ? null : (
              <span className="absolute right-2 -top-2 bg-white px-1 dark:bg-slate-900">
                {formatMinutes(h * 60)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        className="relative flex-1 border-l border-slate-300 dark:border-slate-600"
        style={{
          height: GRID_HEIGHT,
          backgroundImage: [
            `repeating-linear-gradient(to bottom, rgba(148,163,184,0.20) 0 1px, transparent 1px ${fivePx}px)`,
            `repeating-linear-gradient(to bottom, rgba(148,163,184,0.45) 0 1px, transparent 1px ${halfPx}px)`,
            `repeating-linear-gradient(to bottom, rgba(100,116,139,0.65) 0 1px, transparent 1px ${hourPx}px)`,
          ].join(', '),
        }}
        onPointerDown={onGridPointerDown}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerUp}
        onPointerCancel={onGridPointerUp}
      >

        {selection && (
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-md border-2 border-dashed border-sky-400 bg-sky-100/60 dark:bg-sky-900/40"
            style={{
              top: minutesToPx(selection.startMinutes),
              height: Math.max(minutesToPx(selection.endMinutes - selection.startMinutes), 12),
            }}
          >
            <div className="px-2 py-1 text-xs text-sky-800 dark:text-sky-200">
              {formatMinutes(selection.startMinutes)} – {formatMinutes(selection.endMinutes)}
            </div>
          </div>
        )}

        {dayEvents.map((ev) => (
          <div key={ev.id} data-event-block>
            <EventBlock
              event={ev}
              onChange={(patch) => updateEvent(ev.id, patch)}
              onClick={() => setDialog({ kind: 'edit', event: ev })}
            />
          </div>
        ))}

        {isToday && <CurrentTimeLine />}
      </div>

      <NewEventDialog
        open={dialog?.kind === 'new'}
        initial={dialog?.kind === 'new' ? dialog.initial : undefined}
        onClose={() => setDialog(null)}
        onSave={(data) => {
          addEvent({ ...data, date });
          setDialog(null);
        }}
      />
      <NewEventDialog
        open={dialog?.kind === 'edit'}
        event={dialog?.kind === 'edit' ? dialog.event : undefined}
        onClose={() => setDialog(null)}
        onSave={(data) => {
          if (dialog?.kind !== 'edit') return;
          updateEvent(dialog.event.id, data);
          setDialog(null);
        }}
        onDelete={() => {
          if (dialog?.kind !== 'edit') return;
          removeEvent(dialog.event.id);
          setDialog(null);
        }}
        onDeleteGroup={() => {
          if (dialog?.kind !== 'edit') return;
          const gid = dialog.event.recurringGroupId;
          if (gid) removeGroup(gid);
          setDialog(null);
        }}
      />
    </div>
  );
}
