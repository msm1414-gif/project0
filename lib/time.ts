export const PX_PER_HOUR = 48;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;
export const SNAP_MINUTES = 5;
export const MIN_EVENT_MINUTES = 5;
export const DAY_MINUTES = 24 * 60;
export const GRID_HEIGHT = PX_PER_HOUR * 24;

export function minutesToPx(min: number): number {
  return min * PX_PER_MINUTE;
}

export function pxToMinutes(px: number): number {
  return px / PX_PER_MINUTE;
}

export function snap(min: number): number {
  return Math.max(0, Math.min(DAY_MINUTES, Math.round(min / SNAP_MINUTES) * SNAP_MINUTES));
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function timeOptions(stepMinutes = SNAP_MINUTES): { value: number; label: string }[] {
  const opts: { value: number; label: string }[] = [];
  for (let m = 0; m <= DAY_MINUTES; m += stepMinutes) {
    opts.push({ value: m, label: formatMinutes(Math.min(m, DAY_MINUTES - 1)) });
  }
  return opts;
}
