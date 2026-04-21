import { loadSettings, rememberSubjectPage } from './settings';

export interface CreatedPage {
  id: string;
  url: string;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export async function testNotion(token: string, parentPageId: string) {
  return postJSON<{ ok: boolean; title?: string; error?: string }>(
    '/api/notion/test',
    { token, parentPageId },
  );
}

export async function createNotionPage(
  parentPageId: string,
  title: string,
  children?: unknown[],
): Promise<CreatedPage> {
  const s = loadSettings();
  if (!s.notionToken) throw new Error('Notion トークンが未設定です');
  const res = await postJSON<{ ok: boolean; id?: string; url?: string; error?: string }>(
    '/api/notion/create-page',
    { token: s.notionToken, parentPageId, title, children },
  );
  if (!res.ok || !res.id || !res.url) {
    throw new Error(res.error ?? 'ページ作成に失敗しました');
  }
  return { id: res.id, url: res.url };
}

export async function ensureSubjectPage(subject: string): Promise<string> {
  const s = loadSettings();
  const existing = s.subjectPageIds[subject];
  if (existing) return existing;
  if (!s.notionParentPageId) throw new Error('親ページ ID が未設定です');
  const page = await createNotionPage(s.notionParentPageId, subject);
  rememberSubjectPage(subject, page.id);
  return page.id;
}

export function paragraph(text: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: text ? [{ type: 'text', text: { content: text } }] : [],
    },
  };
}

export function heading2(text: string) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content: text } }] },
  };
}
