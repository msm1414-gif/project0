'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { eachDayOfInterval } from 'date-fns';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { isJapaneseHoliday } from '@/lib/holidays';
import { isNotionConfigured, loadSettings } from '@/lib/settings';
import { createNotionPage, ensureSubjectPage, heading2, paragraph } from '@/lib/notion-client';
import {
  defaultSemesterYear,
  fallSemester,
  PERIOD_TIMES,
  springSemester,
  type Semester,
} from '@/lib/semesters';
import { fileToBase64, parseTimetableImage, type ParsedClass } from '@/lib/timetable-client';
import { formatDate, formatMinutes, parseDate } from '@/lib/time';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage = 'config' | 'parsing' | 'review' | 'creating' | 'done';

interface RowDraft extends ParsedClass {
  enabled: boolean;
}

export default function TimetableImportDialog({ open, onClose }: Props) {
  if (!open) return null;
  return <Body onClose={onClose} />;
}

function Body({ onClose }: { onClose: () => void }) {
  const addEvents = useApp((s) => s.addEvents);
  const updateEvent = useApp((s) => s.updateEvent);

  const defaultYears = defaultSemesterYear();
  const [semesterKey, setSemesterKey] = useState<'spring' | 'fall'>('spring');
  const [year, setYear] = useState<number>(defaultYears.spring);
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [createNotion, setCreateNotion] = useState(true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('config');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  const semester: Semester = semesterKey === 'spring' ? springSemester(year) : fallSemester(year);
  const notionConfigured = isNotionConfigured(loadSettings());

  const dateCount = useMemo(() => {
    const map = new Map<number, { total: number; skipped: number }>();
    for (let day = 0; day < 7; day++) map.set(day, { total: 0, skipped: 0 });
    for (const r of semester.ranges) {
      const days = eachDayOfInterval({ start: parseDate(r.start), end: parseDate(r.end) });
      for (const d of days) {
        const dow = d.getDay();
        const stats = map.get(dow)!;
        if (excludeHolidays && isJapaneseHoliday(d)) stats.skipped++;
        else stats.total++;
      }
    }
    return map;
  }, [semester, excludeHolidays]);

  function pickFile(file: File | null) {
    setError(null);
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function onParse() {
    if (!imageFile) return;
    const apiKey = loadSettings().anthropicApiKey;
    if (!apiKey) {
      setError('Anthropic API キーが未設定です。⚙️ 設定から登録してください。');
      return;
    }
    setStage('parsing');
    setError(null);
    try {
      const { data, mediaType } = await fileToBase64(imageFile);
      const mt =
        mediaType === 'image/jpeg' || mediaType === 'image/webp' || mediaType === 'image/gif'
          ? mediaType
          : 'image/png';
      const res = await parseTimetableImage(apiKey, data, mt);
      if (!res.ok || !res.classes) {
        throw new Error(res.error ?? '解析に失敗しました');
      }
      setRows(res.classes.map((c) => ({ ...c, enabled: true })));
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('config');
    }
  }

  function updateRow(idx: number, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEmptyRow() {
    setRows((prev) => [...prev, { subject: '', day: 1, period: 1, enabled: true }]);
  }

  async function onCreate() {
    setStage('creating');
    setError(null);
    try {
      const enabled = rows.filter((r) => r.enabled && r.subject.trim());
      const groupedBySubject = new Map<string, RowDraft[]>();
      for (const r of enabled) {
        const key = r.subject.trim();
        const list = groupedBySubject.get(key) ?? [];
        list.push(r);
        groupedBySubject.set(key, list);
      }

      let totalCreated = 0;
      const created: { subject: string; eventIds: string[] }[] = [];
      const totalSubjects = groupedBySubject.size;
      let subjectIndex = 0;

      for (const [subject, subjectRows] of groupedBySubject) {
        subjectIndex++;
        setProgress(`予定作成中 ${subjectIndex}/${totalSubjects}: ${subject}`);
        const groupId = `tt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const eventInputs: Parameters<typeof addEvents>[0] = [];
        for (const r of subjectRows) {
          const period = PERIOD_TIMES.find((p) => p.period === r.period)!;
          for (const range of semester.ranges) {
            const days = eachDayOfInterval({ start: parseDate(range.start), end: parseDate(range.end) });
            for (const d of days) {
              if (d.getDay() !== r.day) continue;
              if (excludeHolidays && isJapaneseHoliday(d)) continue;
              eventInputs.push({
                title: subject,
                category: 'university',
                date: formatDate(d),
                startMinutes: period.start,
                endMinutes: period.end,
                recurringGroupId: groupId,
              });
            }
          }
        }
        const events = addEvents(eventInputs);
        totalCreated += events.length;
        created.push({ subject, eventIds: events.map((e) => e.id) });
      }

      // Notion ノート生成
      if (createNotion && notionConfigured) {
        let i = 0;
        for (const { subject, eventIds } of created) {
          i++;
          setProgress(`Notion 科目ページ確認 ${i}/${created.length}: ${subject}`);
          try {
            const subjectPageId = await ensureSubjectPage(subject);
            for (let j = 0; j < eventIds.length; j++) {
              const eventId = eventIds[j];
              setProgress(`Notion ノート作成 ${subject} ${j + 1}/${eventIds.length}`);
              const ev = useApp.getState().events.find((e) => e.id === eventId);
              if (!ev) continue;
              const page = await createNotionPage(subjectPageId, `${ev.date} ${subject}`, [
                heading2('メモ'),
                paragraph(''),
                heading2('講義資料'),
                paragraph(''),
              ]);
              updateEvent(eventId, { notionPageUrl: page.url, notionPageId: page.id });
            }
          } catch (err) {
            // Notion エラーは予定作成自体は成功なので警告のみ
            setError(
              `Notion 作成中にエラー (${subject}): ${err instanceof Error ? err.message : String(err)}。予定は作成済みです。`,
            );
          }
        }
      }

      setProgress(`${totalCreated} 件の予定を作成しました`);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('review');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl shadow-black/10 sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">時間割スクショから取り込み</h2>
        <p className="mt-1 text-xs text-slate-500">
          UTOL の時間割画面のスクショをアップロードすると、Claude が科目・曜日・時限を自動で読み取って、指定した学期に一括登録します。
        </p>

        {/* 学期選択 */}
        <section className="mt-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">学期</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSemesterKey('spring');
                setYear(defaultYears.spring);
              }}
              className={clsx(
                'rounded border px-3 py-1 text-sm',
                semesterKey === 'spring'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            >
              春学期 (4/6 – 7/30)
            </button>
            <button
              type="button"
              onClick={() => {
                setSemesterKey('fall');
                setYear(defaultYears.fall);
              }}
              className={clsx(
                'rounded border px-3 py-1 text-sm',
                semesterKey === 'fall'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-300 dark:border-slate-600',
              )}
            >
              秋学期 (10/1 – 12/29 / 1/4 – 2/4)
            </button>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              aria-label="年"
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            選択中: {semester.label} —{' '}
            {semester.ranges.map((r, i) => (
              <span key={i}>
                {i > 0 && ', '}
                {r.start} 〜 {r.end}
              </span>
            ))}
          </div>
        </section>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={excludeHolidays}
            onChange={(e) => setExcludeHolidays(e.target.checked)}
            className="h-4 w-4 accent-slate-700"
          />
          <span className="text-slate-600 dark:text-slate-300">祝日を除く</span>
        </label>
        {notionConfigured && (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createNotion}
              onChange={(e) => setCreateNotion(e.target.checked)}
              className="h-4 w-4 accent-slate-700"
            />
            <span className="text-slate-600 dark:text-slate-300">Notion に講義ノートも自動作成</span>
          </label>
        )}

        {/* ステージ別 UI */}
        {stage === 'config' && (
          <section className="mt-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">時間割のスクショ</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
            {imagePreview && (
              <div className="mt-2 flex items-center justify-center rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="プレビュー" className="max-h-64 max-w-full object-contain" />
              </div>
            )}
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={onParse}
                disabled={!imageFile}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                AI で解析
              </button>
            </div>
          </section>
        )}

        {stage === 'parsing' && (
          <div className="mt-6 rounded border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
            🤖 Claude が画像を解析中... (10〜20 秒)
          </div>
        )}

        {stage === 'review' && (
          <section className="mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                抽出された講義 ({rows.filter((r) => r.enabled).length}/{rows.length})
              </div>
              <button
                type="button"
                onClick={addEmptyRow}
                className="text-xs text-sky-600 underline hover:text-sky-700"
              >
                + 行を追加
              </button>
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto rounded border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="w-8 px-2 py-1.5"></th>
                    <th className="px-2 py-1.5 text-left">科目名</th>
                    <th className="w-20 px-2 py-1.5">曜日</th>
                    <th className="w-20 px-2 py-1.5">時限</th>
                    <th className="w-32 px-2 py-1.5 text-left">時刻</th>
                    <th className="w-16 px-2 py-1.5">回数</th>
                    <th className="w-8 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const period = PERIOD_TIMES.find((p) => p.period === r.period);
                    const stats = dateCount.get(r.day);
                    return (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={r.enabled}
                            onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                            className="h-4 w-4 accent-slate-700"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={r.subject}
                            onChange={(e) => updateRow(i, { subject: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={r.day}
                            onChange={(e) => updateRow(i, { day: Number(e.target.value) })}
                            className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                          >
                            {WEEKDAYS.map((w, j) => (
                              <option key={j} value={j}>
                                {w}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={r.period}
                            onChange={(e) => updateRow(i, { period: Number(e.target.value) })}
                            className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                          >
                            {PERIOD_TIMES.map((p) => (
                              <option key={p.period} value={p.period}>
                                {p.period}限
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1 text-xs text-slate-500">
                          {period && `${formatMinutes(period.start)}–${formatMinutes(period.end)}`}
                        </td>
                        <td className="px-2 py-1 text-center text-xs text-slate-500">
                          {stats ? stats.total : '-'}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="text-xs text-slate-400 hover:text-red-500"
                            aria-label="削除"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <span className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${CATEGORY_STYLES.university.swatch}`} />
              すべて「大学」カテゴリで作成されます
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStage('config')}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                ← 画像を変更
              </button>
              <button
                type="button"
                onClick={onCreate}
                disabled={rows.filter((r) => r.enabled && r.subject.trim()).length === 0}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                予定を作成
              </button>
            </div>
          </section>
        )}

        {stage === 'creating' && (
          <div className="mt-6 rounded border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
            {progress ?? '処理中...'}
          </div>
        )}

        {stage === 'done' && (
          <div className="mt-6">
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              ✓ {progress}
            </div>
            {error && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                ⚠️ {error}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-slate-900"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
