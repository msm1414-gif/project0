import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token, parentPageId } = (await req.json()) as { token?: string; parentPageId?: string };
  if (!token || !parentPageId) {
    return NextResponse.json({ ok: false, error: 'token と parentPageId が必要です' }, { status: 400 });
  }
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${parentPageId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data?.message ?? 'Notion API エラー' }, { status: 200 });
    }
    const title =
      data?.properties?.title?.title?.[0]?.plain_text ??
      data?.properties?.Name?.title?.[0]?.plain_text ??
      '(タイトルなし)';
    return NextResponse.json({ ok: true, title });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
