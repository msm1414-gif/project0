// 日記Bot のドメイン型。設計書セクション4・8 に対応。

// --- スロット（設計書セクション4: 8スロット A-H） ---

export type SlotId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface SlotDef {
  id: SlotId;
  label: string;
  core: boolean; // true=毎晩のコア(A/B/C), false=ローテーション(D-H)
}

export const SLOTS: Record<SlotId, SlotDef> = {
  A: { id: 'A', label: '出来事＋感情', core: true },
  B: { id: 'B', label: '感謝・よかったこと', core: true },
  C: { id: 'C', label: '体調・調子', core: true },
  D: { id: 'D', label: '目標・進捗・成果', core: false },
  E: { id: 'E', label: 'タスク・ToDo', core: false },
  F: { id: 'F', label: '学習・気づき', core: false },
  G: { id: 'G', label: '反省・改善点', core: false },
  H: { id: 'H', label: '創造的アイデア', core: false },
};

export const CORE_SLOTS: SlotId[] = ['A', 'B', 'C'];
export const ROTATION_SLOTS: SlotId[] = ['D', 'E', 'F', 'G', 'H'];

// 感情ラベルは決まった語彙で持つ（週次振り返りで傾向を出すため）
export type EmotionLabel =
  | 'joy' // 喜び
  | 'anger' // 怒り
  | 'anxiety' // 不安
  | 'sadness' // 悲しみ
  | 'relief' // 安心
  | 'fatigue' // 疲れ
  | 'excitement' // 高揚
  | 'calm'; // 平穏

export const EMOTION_LABELS: Record<EmotionLabel, string> = {
  joy: '喜び',
  anger: '怒り',
  anxiety: '不安',
  sadness: '悲しみ',
  relief: '安心',
  fatigue: '疲れ',
  excitement: '高揚',
  calm: '平穏',
};

// 体調は3段階の数値で持つ（天候・曜日との相関を見るため）
export type ConditionScore = 1 | 2 | 3; // 1=△ 2=○ 3=◎

// --- 会話メッセージ（設計書8: messages） ---

export type MessageSender = 'user' | 'bot';

export interface DiaryMessage {
  id: string;
  userId: string;
  sender: MessageSender;
  body: string;
  // 'daytime' = 日中の自発メッセージ / 'session' = 夜の会話セッション内
  context: 'daytime' | 'session';
  createdAt: string; // ISO8601
}

// --- 日ごとの生ログ（設計書8: daily_logs） ---

export interface SlotFill {
  filled: boolean;
  // スロットごとの構造化フィールド（週次清書の素材）
  emotions?: EmotionLabel[]; // スロットA
  condition?: ConditionScore; // スロットC
  text?: string; // 自由記述の要点
}

export interface DailyLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD (JST)
  slots: Partial<Record<SlotId, SlotFill>>;
  // 当夜の会話で実際に聞いたローテーションスロット
  askedRotation: SlotId[];
  createdAt: string;
  updatedAt: string;
}

// --- 清書日記（設計書8: diary_entries、週次バッチで生成） ---

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  body: string; // 清書された文章
  emotions: EmotionLabel[];
  condition?: ConditionScore;
  createdAt: string;
}

// --- 週次まとめ（設計書8: weekly_summaries） ---

export interface WeeklySummary {
  id: string;
  userId: string;
  weekStart: string; // その週の月曜 YYYY-MM-DD
  body: string;
  gratitudeList: string[];
  goalProgress: string;
  emotionTrend: Partial<Record<EmotionLabel, number>>;
  createdAt: string;
}

// --- 週次質問プラン（設計書8: weekly_plans、週初めに生成） ---

export interface PlanDay {
  date: string; // YYYY-MM-DD
  theme: string; // その日の重点テーマ
  anchors: string[]; // カレンダー予定由来の質問アンカー
  focusSlots: SlotId[]; // その夜に重点的に聞きたいスロット
}

export interface WeeklyPlan {
  id: string;
  userId: string;
  weekStart: string;
  days: PlanDay[];
  createdAt: string;
}

// --- ユーザー（設計書8: users） ---

export interface DiaryUser {
  id: string; // 内部ID
  lineUserId: string;
  registeredAt: string;
  deliveryHour: number; // 夜の口火を切る時刻(JST, 0-23)
  botPersona: string; // Bot口調設定
  calendarShareToken?: string; // project0カレンダーの共有トークン
}
