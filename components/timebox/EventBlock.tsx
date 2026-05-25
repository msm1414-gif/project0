'use client';

import { useEffect, useRef, useState } from 'react';
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
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    startX: number;
    startY: number;
    canceledByMove: boolean;
  } | null>(null);

  const duration = event.endMinutes - event.startMinutes;
  const view = preview ?? { start: event.startMinutes, end: event.endMinutes };
  const style = CATEGORY_STYLES[event.category];

  useEffect(() => {
    function preventScroll(e: TouchEvent) {
      if (dragRef.current) e.preventDefault();
    }
    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventScroll);
  }, []);

  function startDrag(mode: DragMode, target: HTMLElement, pointerId: number, clientY: number) {
    // ドラッグ開始と同時に touch-action: none を即座に適用し、
    // iOS がスクロール方向を確定するのを防ぐ
    if (ref.current) ref.current.style.touchAction = 'none';
    target.style.touchAction = 'none';
    try {
      target.setPointerCapture(pointerId);
    } catch {}
    dragRef.current = {
      mode,
      startY: clientY,
      originStart: event.startMinutes,
      originEnd: event.endMinutes,
      moved: false,
    };
  }

  function beginDrag(mode: DragMode, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.pointerType === 'touch') {
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const target = e.currentTarget;
      if (longPressRef.current) clearTimeout(longPressRef.current.timer);
      longPressRef.current = {
        startX,
        startY,
        canceledByMove: false,
        timer: setTimeout(() => {
          const lp = longPressRef.current;
          longPressRef.current = null;
          if (!lp || lp.canceledByMove) return;
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate?.(30);
            } catch {}
          }
          startDrag(mode, target, pointerId, startY);
        }, 350),
      };
      return;
    }
    startDrag(mode, e.currentTarget, e.pointerId, e.clientY);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const lp = longPressRef.current;
    if (lp && !lp.canceledByMove) {
      if (Math.abs(e.clientX - lp.startX) > 10 || Math.abs(e.clientY - lp.startY) > 10) {
        lp.canceledByMove = true;
        clearTimeout(lp.timer);
      }
      return;
    }
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

  function restoreTouchAction(e: React.PointerEvent<HTMLDivElement>) {
    if (ref.current) ref.current.style.touchAction = '';
    (e.currentTarget as HTMLElement).style.touchAction = '';
    (e.target as HTMLElement).style.touchAction = '';
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const lp = longPressRef.current;
    longPressRef.current = null;
    const d = dragRef.current;
    dragRef.current = null;
    restoreTouchAction(e);

    if (lp) {
      clearTimeout(lp.timer);
      if (!lp.canceledByMove) {
        // 長押しがまだ成立していない短いタップ → 編集ダイアログを開く
        onClick();
      }
      // canceledByMove のときは何もしない (ブラウザの scroll に任せる)
      return;
    }

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
        'absolute left-1.5 right-1.5 rounded-lg cursor-grab select-none overflow-hidden touch-pan-y transition-shadow active:cursor-grabbing',
        preview ? 'shadow-md ring-2 ring-sky-400/70' : 'shadow-sm hover:shadow-md',
        event.tentative ? style.blockTentative : style.block,
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
        className="absolute inset-x-0 top-0 h-2 cursor-ns-resize touch-pan-y"
        onPointerDown={(e) => beginDrag('resize-top', e)}
      />
      <div className={clsx('px-2 py-1 text-xs leading-tight', compact && 'py-0.5')}>
        <div className="truncate font-medium">{event.title || '(無題)'}</div>
        {!compact && (
          <div className="tabular text-[11px] opacity-75">
            {formatMinutes(view.start)} – {formatMinutes(view.end)}
          </div>
        )}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-pan-y"
        onPointerDown={(e) => beginDrag('resize-bottom', e)}
      />
    </div>
  );
}
