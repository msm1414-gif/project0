import type { Category } from './types';

export interface CategoryStyle {
  block: string;
  blockTentative: string;
  dot: string;
  chip: string;
  chipTentative: string;
  swatch: string;
}

// Refined: soft tinted fills + thin left accent bar; chips use subtle background + ring
export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  university: {
    block:
      'bg-blue-50 border-l-[3px] border-blue-500 text-blue-900 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/25 dark:border-blue-400',
    blockTentative:
      'bg-blue-50/60 border-l-[3px] border-dashed border-blue-400 text-blue-700 hover:bg-blue-100/70 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-400/70 opacity-90',
    dot: 'bg-blue-500',
    chip:
      'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/30',
    chipTentative:
      'bg-transparent text-blue-700 ring-1 ring-inset ring-blue-300 ring-dashed dark:text-blue-300 dark:ring-blue-400/40 opacity-90',
    swatch: 'bg-blue-500',
  },
  work: {
    block:
      'bg-amber-50 border-l-[3px] border-amber-500 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/25 dark:border-amber-400',
    blockTentative:
      'bg-amber-50/60 border-l-[3px] border-dashed border-amber-400 text-amber-700 hover:bg-amber-100/70 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-400/70 opacity-90',
    dot: 'bg-amber-500',
    chip:
      'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30',
    chipTentative:
      'bg-transparent text-amber-700 ring-1 ring-inset ring-amber-300 ring-dashed dark:text-amber-300 dark:ring-amber-400/40 opacity-90',
    swatch: 'bg-amber-500',
  },
  circle: {
    block:
      'bg-rose-50 border-l-[3px] border-rose-500 text-rose-900 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-100 dark:hover:bg-rose-500/25 dark:border-rose-400',
    blockTentative:
      'bg-rose-50/60 border-l-[3px] border-dashed border-rose-400 text-rose-700 hover:bg-rose-100/70 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-400/70 opacity-90',
    dot: 'bg-rose-500',
    chip:
      'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30',
    chipTentative:
      'bg-transparent text-rose-700 ring-1 ring-inset ring-rose-300 ring-dashed dark:text-rose-300 dark:ring-rose-400/40 opacity-90',
    swatch: 'bg-rose-500',
  },
  leisure: {
    block:
      'bg-emerald-50 border-l-[3px] border-emerald-500 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25 dark:border-emerald-400',
    blockTentative:
      'bg-emerald-50/60 border-l-[3px] border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-100/70 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-400/70 opacity-90',
    dot: 'bg-emerald-500',
    chip:
      'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30',
    chipTentative:
      'bg-transparent text-emerald-700 ring-1 ring-inset ring-emerald-300 ring-dashed dark:text-emerald-300 dark:ring-emerald-400/40 opacity-90',
    swatch: 'bg-emerald-500',
  },
  other: {
    block:
      'bg-zinc-100 border-l-[3px] border-zinc-500 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-100 dark:hover:bg-zinc-500/25 dark:border-zinc-400',
    blockTentative:
      'bg-zinc-50/60 border-l-[3px] border-dashed border-zinc-400 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-500/10 dark:text-zinc-200 dark:border-zinc-400/70 opacity-90',
    dot: 'bg-zinc-500',
    chip:
      'bg-zinc-100 text-zinc-800 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-200 dark:ring-zinc-400/30',
    chipTentative:
      'bg-transparent text-zinc-700 ring-1 ring-inset ring-zinc-300 ring-dashed dark:text-zinc-300 dark:ring-zinc-400/40 opacity-90',
    swatch: 'bg-zinc-500',
  },
};
