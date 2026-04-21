import { NextResponse } from 'next/server';

interface CreateBody {
  token: string;
  parentPageId: string;
  title: string;
  children?: unknown[];
}

export async function POST(req: Request) {
  let body: Partial<CreateBody>;
  try {
    body = (await req.json()) as Partial<CreateBody>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { token, parentPageId, title, children } = body;
  if (!token || !parentPageId || !title) {
    return NextResponse.json(
      { ok: false, error: 'token, parentPageId, title が必要です' },
      { status: 400 },
    );
  }
  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { page_id: parentPageId },
        properties: {
          title: { title: [{ type: 'text', text: { content: title } }] },
        },
        ...(children ? { children } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.message ?? 'Notion API エラー' },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, id: data.id as string, url: data.url as string });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
