'use client';

const KEY = 'timebox-settings-v1';

export interface Settings {
  notionToken: string;
  notionParentPageId: string;
  subjectPageIds: Record<string, string>;
}

const DEFAULTS: Settings = {
  notionToken: '',
  notionParentPageId: '',
  subjectPageIds: {},
};

function normalizePageId(raw: string): string {
  const hex = raw.replace(/[^a-f0-9]/gi, '').toLowerCase();
  if (hex.length !== 32) return raw.trim();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...parsed,
      subjectPageIds: { ...DEFAULTS.subjectPageIds, ...(parsed.subjectPageIds ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const current = loadSettings();
  const next: Settings = {
    ...current,
    ...patch,
    subjectPageIds: { ...current.subjectPageIds, ...(patch.subjectPageIds ?? {}) },
  };
  if (next.notionParentPageId) {
    next.notionParentPageId = normalizePageId(next.notionParentPageId);
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  return next;
}

export function rememberSubjectPage(title: string, pageId: string) {
  const s = loadSettings();
  saveSettings({ subjectPageIds: { ...s.subjectPageIds, [title]: pageId } });
}

export function isNotionConfigured(s?: Settings): boolean {
  const cur = s ?? loadSettings();
  return !!(cur.notionToken && cur.notionParentPageId);
}
