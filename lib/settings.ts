'use client';

const KEY = 'timebox-settings-v1';

export interface Settings {
  notionToken: string;
  notionParentPageId: string;
  subjectPageIds: Record<string, string>;
  shareToken: string;
}

const DEFAULTS: Settings = {
  notionToken: '',
  notionParentPageId: '',
  subjectPageIds: {},
  shareToken: '',
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

export function generateShareToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function ensureShareToken(): string {
  const s = loadSettings();
  if (s.shareToken) return s.shareToken;
  const token = generateShareToken();
  saveSettings({ shareToken: token });
  return token;
}
