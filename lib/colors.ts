import type { Category } from './types';

export interface CategoryStyle {
  block: string;
  dot: string;
  chip: string;
  swatch: string;
}

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  university: {
    block: 'bg-blue-100 border-l-4 border-blue-500 text-blue-900 hover:bg-blue-200',
    dot: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-800 border border-blue-300',
    swatch: 'bg-blue-500',
  },
  work: {
    block: 'bg-amber-100 border-l-4 border-amber-500 text-amber-900 hover:bg-amber-200',
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800 border border-amber-300',
    swatch: 'bg-amber-500',
  },
  leisure: {
    block: 'bg-emerald-100 border-l-4 border-emerald-500 text-emerald-900 hover:bg-emerald-200',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    swatch: 'bg-emerald-500',
  },
  other: {
    block: 'bg-slate-100 border-l-4 border-slate-500 text-slate-900 hover:bg-slate-200',
    dot: 'bg-slate-500',
    chip: 'bg-slate-100 text-slate-800 border border-slate-300',
    swatch: 'bg-slate-500',
  },
};
