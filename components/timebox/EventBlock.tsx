'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import type { Event } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/colors';
import {
  DAY_MINUTES,
  MIN_EVENT_MINUTES,
  formatMinutes,
  minutesToPx,
  pxToMinutes,
  snap,
} from '@/lib/time';

type DragMode = 'move' | 'resize-top' | 'resize-bottom';

interface Props {
  event: Event;
  onChange: (patch: Partial<Pick<Event, 'startMinutes' | 'endMinutes'>>) => void;
  onClick: () => void;
}

export default function EventBlock({ event, onChange, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startY: number;
    originStart: number;
    originEnd: number;
    moved: boolean;
  } | null>(null);

  const duration = event.endMinutes - event.startMinutes;
  const view = preview ?? { start: event.startMinutes, end: event.endMinutes };
  const style = CATEGORY_STYLES[event.category];

  function beginDrag(mode: DragMode, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startY: e.clientY,
      originStart: event.startMinutes,
      originEnd: event.endMinutes,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const deltaMin = pxToMinutes(e.clientY - d.startY);
    if (Math.abs(deltaMin) > 1) d.moved = true;
    let start = d.originStart;
    let end = d.originEnd;
    if (d.mode === 'move') {
      const shift = snap(deltaMin);
      start = d.originStart + shift;
      end = d.originEnd + shift;
      if (start < 0) {
        end -= start;
        start = 0;
      }
      if (end > DAY_MINUTES) {
        start -= end - DAY_MINUTES;
        end = DAY_MINUTES;
      }
    } else if (d.mode === 'resize-top') {
      start = snap(d.originStart + deltaMin);
      start = Math.min(start, d.originEnd - MIN_EVENT_MINUTES);
      start = Math.max(0, start);
    } else {
      end = snap(d.originEnd + deltaMin);
      end = Math.max(end, d.originStart + MIN_EVENT_MINUTES);
      end = Math.min(DAY_MINUTES, end);
    }
    setPreview({ start, end });
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    const p = preview;
    setPreview(null);
    if (!d.moved) {
      onClick();
      return;
    }
    if (p && (p.start !== d.originStart || p.end !== d.originEnd)) {
      onChange({ startMinutes: p.start, endMinutes: p.end });
    }
  }

  const compact = duration <= 25;

  return (
    <div
      ref={ref}
      className={clsx(
        'absolute left-[52px] right-1 rounded-md shadow-sm cursor-grab active:cursor-grabbing select-none overflow-hidden',
        style.block,
      )}
      style={{
        top: minutesToPx(view.start),
        height: Math.max(minutesToPx(view.end - view.start), 12),
      }}
      onPointerDown={(e) => beginDrag('move', e)}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
        onPointerDown={(e) => beginDrag('resize-top', e)}
      />
      <div className={clsx('px-2 py-1 text-xs leading-tight', compact && 'py-0.5')}>
        <div className="font-medium truncate">{event.title || '(無題)'}</div>
        {!compact && (
          <div className="text-[11px] opacity-75">
            {formatMinutes(view.start)} – {formatMinutes(view.end)}
          </div>
        )}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
        onPointerDown={(e) => beginDrag('resize-bottom', e)}
      />
    </div>
  );
}
