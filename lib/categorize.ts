import type { Category } from './types';
import { loadSettings } from './settings';

const KEYWORDS: { category: Category; words: string[] }[] = [
  { category: 'university', words: ['大学', '講義', '授業', 'ゼミ', '研究', 'レポート', '試験', '学校', 'class', 'lecture'] },
  { category: 'work', words: ['バイト', 'アルバイト', '仕事', 'シフト', '勤務', 'work', 'shift', 'job'] },
  { category: 'circle', words: ['サークル', '部活', '部会', '練習', 'ミーティング', '新歓', '合宿', 'circle', 'club'] },
  { category: 'leisure', words: ['遊び', '映画', '飲み', 'ゲーム', '友達', '趣味', 'ライブ', 'デート', 'カラオケ', 'party'] },
];

export function inferCategory(title: string): Category {
  const lower = title.toLowerCase();
  // ユーザー定義のサークルキーワードを最優先
  if (typeof window !== 'undefined') {
    const userKws = loadSettings().circleKeywords;
    if (userKws.some((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase()))) {
      return 'circle';
    }
  }
  for (const { category, words } of KEYWORDS) {
    if (words.some((w) => lower.includes(w.toLowerCase()))) {
      return category;
    }
  }
  return 'other';
}

export function matchesCircleKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase()));
}
