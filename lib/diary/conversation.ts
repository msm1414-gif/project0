// 会話エンジン。会話本体は AI 生成（設計書セクション1・「機械っぽさを減らす」）。
// 体調スロットや障害時フォールバックは定型（line.ts 呼び出し側で対応）。

import { getAIProvider, type ChatTurn } from './ai';
import { formatEventsForPrompt, getCalendarEvents, type CalendarEvent } from './calendar';
import type { DiaryMessage, DiaryUser } from './types';

// Bot の人格（設計書7-5・口調は未確定。ここを調整すれば一貫した人格になる）。
// 個人利用なので当面はこの1種類。users.bot_persona で将来切り替え可能。
const DEFAULT_PERSONA = `あなたは「日記Bot」。ユーザーと夜にゆるく雑談しながら、
気づいたら一日が言語化されている——そんな体験をつくる聞き手。
- 口調はやわらかく、友人のように。敬語すぎず、なれなれしすぎず。
- 必ず直前の発言に一度反応してから、次の質問を一つだけする。
- 一度に複数のことを聞かない。フォームのように見せない。
- 同じ言い回しを繰り返さない。`;

// 会話の進め方（スロット運用。設計書セクション4・7-1/7-2）。
const SLOT_GUIDANCE = `一晩の会話は6〜7往復。聞きたいことの優先順位:
- 毎晩のコア: A 出来事＋そのときの感情 / B 今日よかったこと / C 体調(◎○△で軽く)
- ローテーション: D 目標進捗 / E 明日のタスク / F 学習・気づき / G 反省 / H アイデア
  → コアが埋まったら、その夜の会話の流れに合うものを1〜2個だけ自然に聞く。
ルール:
- すでに話に出た項目は聞き直さない。流れで深掘りするほうを優先する。
- カレンダーの予定があれば、抽象的な質問より予定に紐づけて具体的に聞く。
- 会話が一区切りついたら、無理に質問を続けず自然に締める。`;

function persona(): string {
  // 将来 user.botPersona で分岐。当面は default のみ。
  return DEFAULT_PERSONA;
}

function buildSystemPrompt(calendar: CalendarEvent[], extraContext: string): string {
  return [
    persona(),
    '',
    SLOT_GUIDANCE,
    '',
    '【今週のカレンダー予定（質問の燃料に使う）】',
    formatEventsForPrompt(calendar),
    extraContext ? `\n【補足】\n${extraContext}` : '',
  ].join('\n');
}

function toTurns(messages: DiaryMessage[]): ChatTurn[] {
  return messages.map((m) => ({
    role: m.sender === 'bot' ? ('model' as const) : ('user' as const),
    content: m.body,
  }));
}

// JST の YYYY-MM-DD を offset 日ずらして返す。
function jstDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 9 + offsetDays * 24);
  return d.toISOString().slice(0, 10);
}

// 夜の口火（push 1通）。日中メッセージ・カレンダー・前日の流れに触れて始める。
export async function generateOpeningMessage(
  user: DiaryUser,
  recentMessages: DiaryMessage[],
): Promise<string> {
  const calendar = user.calendarShareToken
    ? await getCalendarEvents(user.calendarShareToken, jstDate(0), jstDate(7))
    : [];
  const system = buildSystemPrompt(
    calendar,
    '今から夜の会話を始める。あなたから最初の一言を送る。日中のメッセージや今日の予定に' +
      '触れて、自然に「今日どうだった?」の空気をつくる。質問は一つだけ。',
  );
  return getAIProvider().generate({
    system,
    turns: [...toTurns(recentMessages), { role: 'user', content: '(夜の会話を始めて)' }],
    maxTokens: 512,
  });
}

// 夜の会話セッション中の返信。直前の発言に反応し、次を一つ聞く。
export async function generateSessionReply(
  user: DiaryUser,
  sessionMessages: DiaryMessage[],
): Promise<string> {
  const calendar = user.calendarShareToken
    ? await getCalendarEvents(user.calendarShareToken, jstDate(0), jstDate(7))
    : [];
  const system = buildSystemPrompt(calendar, '');
  return getAIProvider().generate({
    system,
    turns: toTurns(sessionMessages),
    maxTokens: 512,
  });
}
