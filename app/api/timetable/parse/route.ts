import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface ParseBody {
  apiKey?: string;
  imageBase64?: string;
  mediaType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
}

interface ParsedClass {
  subject: string;
  day: number;
  period: number;
}

const SYSTEM_PROMPT = `You extract a Japanese university timetable from a screenshot of UTOL (東京大学のオンライン授業システム) and return structured JSON.

Rules:
- For each class entry in the grid, output one object with subject, day, period.
- subject: the class title in Japanese (科目名). Trim whitespace; do not include teacher name, room number, or "(2単位)" type suffixes if separable.
- day: integer 0-6 (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday). UTOL columns are typically Mon-Fri/Sat.
- period: integer 1-5. UTOL rows are 1限〜5限.
- If a class spans multiple consecutive periods (e.g., a single block covering 1限 and 2限), emit one entry per period with the same subject.
- Skip header rows ("月曜", "1限" labels), empty cells, and category-only labels.
- Do not output any commentary, only the JSON object that conforms to the schema.`;

export async function POST(req: Request) {
  let body: Partial<ParseBody>;
  try {
    body = (await req.json()) as Partial<ParseBody>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }
  const { apiKey, imageBase64, mediaType } = body;
  if (!apiKey) return NextResponse.json({ ok: false, error: 'API key is required' }, { status: 400 });
  if (!imageBase64) return NextResponse.json({ ok: false, error: 'image is required' }, { status: 400 });

  const mt = mediaType ?? 'image/png';

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              classes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    subject: { type: 'string' },
                    day: { type: 'integer', enum: [0, 1, 2, 3, 4, 5, 6] },
                    period: { type: 'integer', enum: [1, 2, 3, 4, 5] },
                  },
                  required: ['subject', 'day', 'period'],
                },
              },
            },
            required: ['classes'],
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mt, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Extract every visible class entry from this UTOL timetable screenshot.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) {
      return NextResponse.json({ ok: false, error: '解析結果が空でした' }, { status: 200 });
    }
    let parsed: { classes: ParsedClass[] };
    try {
      parsed = JSON.parse(textBlock.text) as { classes: ParsedClass[] };
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `JSON 解析失敗: ${e instanceof Error ? e.message : String(e)}` },
        { status: 200 },
      );
    }
    const classes = (parsed.classes ?? []).filter(
      (c) => c && typeof c.subject === 'string' && c.subject.trim() && c.day >= 0 && c.day <= 6 && c.period >= 1 && c.period <= 5,
    );
    return NextResponse.json({
      ok: true,
      classes,
      usage: response.usage,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ ok: false, error: 'API キーが無効です' }, { status: 200 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, error: 'レート制限に達しました' }, { status: 200 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { ok: false, error: `Claude API エラー (${err.status}): ${err.message}` },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
