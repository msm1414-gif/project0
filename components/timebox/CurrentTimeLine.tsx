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
        <div className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
        <div className="h-px flex-1 bg-red-500" />
      </div>
    </div>
  );
}
