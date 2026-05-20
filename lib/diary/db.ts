// Supabase アクセス層。サーバー側専用（service_role キーを使う）。
// 環境変数: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DailyLog, DiaryMessage, DiaryUser, SlotId, SlotFill } from './types';

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// --- users ---

export async function getUserByLineId(lineUserId: string): Promise<DiaryUser | null> {
  const { data, error } = await getDb()
    .from('diary_users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    lineUserId: data.line_user_id,
    registeredAt: data.registered_at,
    deliveryHour: data.delivery_hour,
    botPersona: data.bot_persona,
    calendarShareToken: data.calendar_share_token ?? undefined,
  };
}

// LINE ユーザーを取得し、無ければ作成する。
// allowlist（DIARY_OWNER_LINE_USER_ID）が設定されていれば、それ以外は作成しない。
export async function ensureUser(lineUserId: string): Promise<DiaryUser | null> {
  const existing = await getUserByLineId(lineUserId);
  if (existing) return existing;
  const allow = process.env.DIARY_OWNER_LINE_USER_ID;
  if (allow && allow !== lineUserId) return null;
  const { data, error } = await getDb()
    .from('diary_users')
    .insert({ line_user_id: lineUserId })
    .select('*')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    lineUserId: data.line_user_id,
    registeredAt: data.registered_at,
    deliveryHour: data.delivery_hour,
    botPersona: data.bot_persona,
    calendarShareToken: data.calendar_share_token ?? undefined,
  };
}

export async function listUsers(): Promise<DiaryUser[]> {
  const { data, error } = await getDb().from('diary_users').select('*');
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    lineUserId: d.line_user_id,
    registeredAt: d.registered_at,
    deliveryHour: d.delivery_hour,
    botPersona: d.bot_persona,
    calendarShareToken: d.calendar_share_token ?? undefined,
  }));
}

// --- messages ---

export async function insertMessage(
  userId: string,
  sender: DiaryMessage['sender'],
  body: string,
  context: DiaryMessage['context'],
): Promise<void> {
  const { error } = await getDb()
    .from('diary_messages')
    .insert({ user_id: userId, sender, body, context });
  if (error) throw error;
}

// 直近 N 件のメッセージを古い順で返す（会話プロンプトの素材）
export async function getRecentMessages(userId: string, limit = 40): Promise<DiaryMessage[]> {
  const { data, error } = await getDb()
    .from('diary_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((d) => ({
      id: d.id,
      userId: d.user_id,
      sender: d.sender,
      body: d.body,
      context: d.context,
      createdAt: d.created_at,
    }))
    .reverse();
}

// --- daily_logs ---

export async function getDailyLog(userId: string, date: string): Promise<DailyLog | null> {
  const { data, error } = await getDb()
    .from('diary_daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    date: data.log_date,
    slots: data.slots ?? {},
    askedRotation: data.asked_rotation ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function upsertDailyLog(
  userId: string,
  date: string,
  slots: Partial<Record<SlotId, SlotFill>>,
  askedRotation: SlotId[],
): Promise<void> {
  const { error } = await getDb().from('diary_daily_logs').upsert(
    {
      user_id: userId,
      log_date: date,
      slots,
      asked_rotation: askedRotation,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,log_date' },
  );
  if (error) throw error;
}
