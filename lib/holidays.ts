import holiday_jp from '@holiday-jp/holiday_jp';

export function isJapaneseHoliday(date: Date): boolean {
  return holiday_jp.isHoliday(date);
}

export function holidayName(date: Date): string | null {
  const hits = holiday_jp.between(date, date);
  return hits.length > 0 ? hits[0].name : null;
}
