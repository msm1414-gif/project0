'use client';

import { useEffect, useState } from 'react';
import { minutesToPx } from '@/lib/time';

export default function CurrentTimeLine() {
  const [minutes, setMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setMinutes(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20"
      style={{ top: minutesToPx(minutes) }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 -ml-1.5 rounded-full bg-rose-500 ring-2 ring-[var(--bg-elev)]" />
        <div className="h-[1.5px] flex-1 bg-rose-500" />
      </div>
    </div>
  );
}
