// AI 抽象化層（設計書セクション2）。
// 既定は Gemini（無料枠重視）。要約・生成処理は AIProvider 越しに呼び、
// DIARY_AI_PROVIDER=claude で Claude に差し替えられる。
// ※ どのプロバイダの API キーもこのチャットに貼らず、環境変数で渡すこと。

export type ChatRole = 'user' | 'model';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface GenerateOptions {
  system: string;
  turns: ChatTurn[];
  maxTokens?: number;
}

export interface GenerateJSONOptions {
  system: string;
  prompt: string;
  // JSON Schema（プロバイダ間で共通の構造化出力指定）
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface AIProvider {
  readonly name: string;
  // 会話ターン用: 文脈から人間っぽい自由文を1つ生成する
  generate(opts: GenerateOptions): Promise<string>;
  // 週次清書・プランニング用: スキーマに従う構造化 JSON を返す
  generateJSON<T>(opts: GenerateJSONOptions): Promise<T>;
}

// --- Gemini ---

class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const res = await ai.models.generateContent({
      model: this.model,
      contents: opts.turns.map((t) => ({
        role: t.role,
        parts: [{ text: t.content }],
      })),
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 1024,
      },
    });
    return (res.text ?? '').trim();
  }

  async generateJSON<T>(opts: GenerateJSONOptions): Promise<T> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const res = await ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 4096,
        responseMimeType: 'application/json',
        responseSchema: opts.schema,
      },
    });
    return JSON.parse(res.text ?? '{}') as T;
  }
}

// --- Claude（差し替え先） ---

class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: this.apiKey });
    const res = await client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.turns.map((t) => ({
        role: t.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: t.content,
      })),
    });
    const text = res.content.find((b) => b.type === 'text');
    return text && text.type === 'text' ? text.text.trim() : '';
  }

  async generateJSON<T>(opts: GenerateJSONOptions): Promise<T> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: this.apiKey });
    const res = await client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      output_config: {
        format: { type: 'json_schema', schema: opts.schema },
      },
      messages: [{ role: 'user', content: opts.prompt }],
    } as Parameters<typeof client.messages.create>[0]);
    const msg = res as { content: { type: string; text?: string }[] };
    const text = msg.content.find((b) => b.type === 'text');
    return JSON.parse(text?.text ?? '{}') as T;
  }
}

// --- ファクトリ ---

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const provider = process.env.DIARY_AI_PROVIDER ?? 'gemini';
  if (provider === 'claude') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY が未設定です');
    cached = new ClaudeProvider(key, process.env.DIARY_CLAUDE_MODEL ?? 'claude-opus-4-7');
  } else {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY が未設定です');
    cached = new GeminiProvider(key, process.env.DIARY_GEMINI_MODEL ?? 'gemini-2.5-flash');
  }
  return cached;
}
