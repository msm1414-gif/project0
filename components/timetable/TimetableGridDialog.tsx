'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useApp } from '@/lib/store';
import { CATEGORY_STYLES } from '@/lib/colors';
import { isNotionConfigured, loadSettings } from '@/lib/settings';
import { createNotionPage, ensureSubjectPage, heading2, paragraph } from '@/lib/notion-client';
import {
  defaultSemesterYear,
  fallSemester,
  PERIOD_TIMES,
  springSemester,
  type Semester,
} from '@/lib/semesters';
import type { Timetable, TimetableCell } from '@/lib/types';
import { formatMinutes } from '@/lib/time';
import { deriveTimetableFromEvents } from '@/lib/timetable-derive';

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_LABELS = ['月', '火', '水', '木', '金', '土'];
const PERIODS = [1, 2, 3, 4, 5];

interface Props {
  open: boolean;
  onClose: () => void;
}

type Stage = 'input' | 'applying' | 'done';

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tt-${Date.now().toString(36)}`;
}

export default function TimetableGridDialog({ open, onClose }: Props) {
  if (!open) return null;
  return <Body onClose={onClose} />;
}

function Body({ onClose }: { onClose: () => void }) {
  const timetables = useApp((s) => s.timetables);
  const events = useApp((s) => s.events);
  const saveTimetable = useApp((s) => s.saveTimetable);
  const removeTimetable = useApp((s) => s.removeTimetable);
  const removeTimetableEvents = useApp((s) => s.removeTimetableEvents);
  const applyTimetable = useApp((s) => s.applyTimetable);
  const updateEvent = useApp((s) => s.updateEvent);

  const defaultYears = defaultSemesterYear();
  const [semesterKey, setSemesterKey] = useState<'spring' | 'fall'>('spring');
  const [year, setYear] = useState<number>(defaultYears.spring);

  // Find existing timetable for this semester+year
  const existing = useMemo(
    () =>
      timetables.find((t) => t.semesterKey === semesterKey && t.year === year) ?? null,
    [timetables, semesterKey, year],
  );

  const semester: Semester =
    semesterKey === 'spring' ? springSemester(year) : fallSemester(year);

  // Try provisional restore from existing events (when no saved timetable)
  const derived = useMemo(() => {
    if (existing) return null;
    const d = deriveTimetableFromEvents(events, semester);
    return Object.keys(d.cells).length > 0 ? d : null;
  }, [existing, events, semester]);

  const [excludeHolidays, setExcludeHolidays] = useState(existing?.excludeHolidays ?? true);
  const [includeSat, setIncludeSat] = useState(existing?.includeSat ?? false);
  const [createNotion, setCreateNotion] = useState(existing?.createNotion ?? true);
  const [grid, setGrid] = useState<Record<string, string>>(() =>
    existing ? cellsToGrid(existing.cells) : (derived?.cells ?? {}),
  );
  // Track which (semester, year) the local state is synced from, to detect when user switches selectors
  const [syncedFor, setSyncedFor] = useState<string>(`${semesterKey}-${year}`);

  const [stage, setStage] = useState<Stage>('input');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notionConfigured = isNotionConfigured(loadSettings());
  const visibleDays = DAYS.filter((d) => includeSat || d !== 6);

  const isProvisional = !existing && !!derived;

  // Auto-load saved timetable (or derived) when semester or year changes
  const currentKey = `${semesterKey}-${year}`;
  if (currentKey !== syncedFor) {
    setSyncedFor(currentKey);
    setGrid(existing ? cellsToGrid(existing.cells) : (derived?.cells ?? {}));
    setExcludeHolidays(existing?.excludeHolidays ?? true);
    setIncludeSat(existing?.includeSat ?? false);
    setCreateNotion(existing?.createNotion ?? true);
  }

  const cellKey = (d: number, p: number) => `${d}-${p}`;
  function setCell(d: number, p: number, v: string) {
    setGrid((prev) => ({ ...prev, [cellKey(d, p)]: v }));
  }
  function clearAll() {
    if (confirm('すべてのセルをクリアしますか？（保存はされません）')) setGrid({});
  }

  const filledCells = Object.entries(grid)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => {
      const [d, p] = k.split('-').map(Number);
      return { day: d, period: p, subject: v.trim() } as TimetableCell;
    });
  const filledCount = filledCells.length;

  async function onSaveAndApply() {
    setStage('applying');
    setError(null);
    try {
      const id = existing?.id ?? newId();
      const timetable: Timetable = {
        id,
        semesterKey,
        year,
        excludeHolidays,
        includeSat,
        createNotion,
        cells: filledCells,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      saveTimetable(timetable);

      setProgress('既存予定を整理して再生成中...');
      const result = applyTimetable(timetable, derived?.sourceEventIds);

      let notionMessages = '';
      if (createNotion && notionConfigured) {
        const grouped = new Map<string, string[]>();
        for (const ev of useApp.getState().events.filter((e) => e.timetableId === id)) {
          if (ev.notionPageUrl) continue;
          const list = grouped.get(ev.title) ?? [];
          list.push(ev.id);
          grouped.set(ev.title, list);
        }
        let i = 0;
        const total = Array.from(grouped.values()).reduce((acc, arr) => acc + arr.length, 0);
        let done = 0;
        for (const [subject, eventIds] of grouped) {
          i++;
          try {
            setProgress(`Notion 科目ページ確認 ${i}/${grouped.size}: ${subject}`);
            const subjectPageId = await ensureSubjectPage(subject);
            for (let j = 0; j < eventIds.length; j++) {
              done++;
              setProgress(`Notion ノート作成 ${done}/${total}: ${subject}`);
              const ev = useApp.getState().events.find((e) => e.id === eventIds[j]);
              if (!ev) continue;
              const page = await createNotionPage(subjectPageId, `${ev.date} ${subject}`, [
                heading2('メモ'),
                paragraph(''),
                heading2('講義資料'),
                paragraph(''),
              ]);
              updateEvent(ev.id, { notionPageUrl: page.url, notionPageId: page.id });
            }
          } catch (err) {
            notionMessages += `\n${subject}: ${err instanceof Error ? err.message : String(err)}`;
          }
        }
      }

      const lines: string[] = [];
      if (result.removed > 0) lines.push(`古い予定 ${result.removed} 件を削除`);
      lines.push(`新しい予定 ${result.created} 件を作成`);
      if (result.preservedNotion > 0) lines.push(`Notion ページ ${result.preservedNotion} 件を引き継ぎ`);
      setProgress(lines.join(' / '));
      if (notionMessages) setError(`Notion 作成エラー:${notionMessages}`);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage('input');
    }
  }

  function onDeleteTimetable() {
    if (!existing) return;
    if (
      !confirm(
        `この時間割と関連する予定 (${useApp.getState().events.filter((e) => e.timetableId === existing.id).length} 件) をすべて削除します。よろしいですか？`,
      )
    )
      return;
    const removed = removeTimetableEvents(existing.id);
    removeTimetable(existing.id);
    setGrid({});
    setProgress(`時間割を削除しました（予定 ${removed} 件削除）`);
    setStage('done');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-5 shadow-2xl shadow-black/10 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">時間割</h2>
          {existing ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
              保存済み（{new Date(existing.updatedAt).toLocaleDateString('ja-JP')} 更新）
            </span>
          ) : isProvisional ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              仮復元中（未保存）
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          科目を入れて「保存して反映」を押すと、学期内の予定が自動で組まれます。後から開いて編集すれば、関連予定が再生成されます。
        </p>

        {stage === 'input' && isProvisional && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            ⚠️ <strong>仮復元モード</strong>: この学期に標準時限と一致する大学カテゴリの予定が
            <strong>{derived?.sourceCount}</strong> 件見つかったので、各コマで最頻のタイトルを自動入力しています。
            内容を確認・修正のうえ「保存して反映」を押すと、元の {derived?.sourceCount} 件は新しい時間割の予定に置き換えられ、以降は通常の編集が可能になります。
          </div>
        )}

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
                          <div className="text-[10px] text-slate-400">{formatMinutes(period.start)}</div>
                          <div className="text-[10px] text-slate-400">{formatMinutes(period.end)}</div>
                        </td>
                        {visibleDays.map((d) => (
                          <td key={d} className="border-r border-slate-200 p-1 align-top last:border-r-0 dark:border-slate-700">
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
                {filledCount} 科目入力中（すべて「大学」カテゴリ）
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

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {existing && (
                <button
                  type="button"
                  onClick={onDeleteTimetable}
                  className="mr-auto rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  この時間割と関連予定を削除
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={onSaveAndApply}
                disabled={filledCount === 0}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                {existing ? '保存して反映' : `${filledCount} 科目で保存・予定を作成`}
              </button>
            </div>
          </>
        )}

        {stage === 'applying' && (
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
              <div className="mt-2 whitespace-pre-wrap rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
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

function cellsToGrid(cells: TimetableCell[]): Record<string, string> {
  const g: Record<string, string> = {};
  for (const c of cells) g[`${c.day}-${c.period}`] = c.subject;
  return g;
}
