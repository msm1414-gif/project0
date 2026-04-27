'use client';

import { useState } from 'react';
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
import { formatDate, formatMinutes, parseDate } from '@/lib/time';

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_LABELS = ['月', '火', '水', '木', '金', '土'];
const PERIODS = [1, 2, 3, 4, 5];

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage = 'input' | 'creating' | 'done';

export default function TimetableGridDialog({ open, onClose }: Props) {
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
  const [includeSat, setIncludeSat] = useState(false);
  const [grid, setGrid] = useState<Record<string, string>>({});

  const [stage, setStage] = useState<Stage>('input');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const semester: Semester = semesterKey === 'spring' ? springSemester(year) : fallSemester(year);
  const notionConfigured = isNotionConfigured(loadSettings());
  const visibleDays = DAYS.filter((d) => includeSat || d !== 6);

  const cellKey = (d: number, p: number) => `${d}-${p}`;
  function setCell(d: number, p: number, v: string) {
    setGrid((prev) => ({ ...prev, [cellKey(d, p)]: v }));
  }
  function clearAll() {
    if (confirm('すべての入力をクリアしますか？')) setGrid({});
  }

  const filledCount = Object.values(grid).filter((v) => v.trim()).length;

  async function onCreate() {
    setStage('creating');
    setError(null);
    try {
      const classes: { subject: string; day: number; period: number }[] = [];
      for (const [k, v] of Object.entries(grid)) {
        if (!v.trim()) continue;
        const [d, p] = k.split('-').map(Number);
        classes.push({ subject: v.trim(), day: d, period: p });
      }
      if (classes.length === 0) {
        setError('科目が入力されていません');
        setStage('input');
        return;
      }
      const grouped = new Map<string, typeof classes>();
      for (const c of classes) {
        const list = grouped.get(c.subject) ?? [];
        list.push(c);
        grouped.set(c.subject, list);
      }
      let totalCreated = 0;
      const created: { subject: string; eventIds: string[] }[] = [];
      let i = 0;
      for (const [subject, list] of grouped) {
        i++;
        setProgress(`予定作成中 ${i}/${grouped.size}: ${subject}`);
        const groupId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? `tt-${crypto.randomUUID()}`
            : `tt-${i}-${subject}`;
        const inputs: Parameters<typeof addEvents>[0] = [];
        for (const c of list) {
          const period = PERIOD_TIMES.find((p) => p.period === c.period)!;
          for (const range of semester.ranges) {
            const days = eachDayOfInterval({
              start: parseDate(range.start),
              end: parseDate(range.end),
            });
            for (const d of days) {
              if (d.getDay() !== c.day) continue;
              if (excludeHolidays && isJapaneseHoliday(d)) continue;
              inputs.push({
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
        const events = addEvents(inputs);
        totalCreated += events.length;
        created.push({ subject, eventIds: events.map((e) => e.id) });
      }
      if (createNotion && notionConfigured) {
        for (let k = 0; k < created.length; k++) {
          const { subject, eventIds } = created[k];
          setProgress(`Notion 科目ページ確認 ${k + 1}/${created.length}: ${subject}`);
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
      setStage('input');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <h2 className="text-lg font-semibold">🗓️ 時間割をまとめて登録</h2>
        <p className="mt-1 text-xs text-slate-500">
          下のグリッドに科目名を入れて「予定を作成」を押すと、選択した学期内の該当曜日に一括登録されます。空白セルはスキップされます。
        </p>

        {stage === 'input' && (
          <>
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
                {semester.label} —{' '}
                {semester.ranges.map((r, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    {r.start} 〜 {r.end}
                  </span>
                ))}
              </div>
            </section>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={excludeHolidays}
                  onChange={(e) => setExcludeHolidays(e.target.checked)}
                  className="h-4 w-4 accent-slate-700"
                />
                <span className="text-slate-600 dark:text-slate-300">祝日を除く</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeSat}
                  onChange={(e) => setIncludeSat(e.target.checked)}
                  className="h-4 w-4 accent-slate-700"
                />
                <span className="text-slate-600 dark:text-slate-300">土曜も表示</span>
              </label>
              {notionConfigured && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createNotion}
                    onChange={(e) => setCreateNotion(e.target.checked)}
                    className="h-4 w-4 accent-slate-700"
                  />
                  <span className="text-slate-600 dark:text-slate-300">Notion ノートも作成</span>
                </label>
              )}
            </div>

            <div className="mt-4 overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="w-20 border-r border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-700">
                      時限
                    </th>
                    {visibleDays.map((d) => (
                      <th
                        key={d}
                        className="border-r border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 last:border-r-0 dark:border-slate-700"
                      >
                        {DAY_LABELS[d - 1]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p) => {
                    const period = PERIOD_TIMES.find((x) => x.period === p)!;
                    return (
                      <tr key={p} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="border-r border-slate-200 bg-slate-50 px-2 py-2 text-center align-top dark:border-slate-700 dark:bg-slate-800">
                          <div className="text-sm font-semibold">{p}限</div>
                          <div className="text-[10px] text-slate-400">
                            {formatMinutes(period.start)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formatMinutes(period.end)}
                          </div>
                        </td>
                        {visibleDays.map((d) => (
                          <td
                            key={d}
                            className="border-r border-slate-200 p-1 align-top last:border-r-0 dark:border-slate-700"
                          >
                            <input
                              type="text"
                              value={grid[cellKey(d, p)] ?? ''}
                              onChange={(e) => setCell(d, p, e.target.value)}
                              placeholder="科目名"
                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_STYLES.university.swatch}`} />
                {filledCount} 科目入力中（すべて「大学」カテゴリで作成）
              </span>
              {filledCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="underline hover:text-slate-700 dark:hover:text-slate-300"
                >
                  すべてクリア
                </button>
              )}
            </div>

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
                onClick={onCreate}
                disabled={filledCount === 0}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                {filledCount} 科目で予定を作成
              </button>
            </div>
          </>
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
