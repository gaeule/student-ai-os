import type { Schedule } from "@/types";

const KST = new Intl.DateTimeFormat("sv", { timeZone: "Asia/Seoul" });

/** Date → "yyyy-MM-dd" (Seoul 기준) */
function toKstDateStr(date: Date): string {
  return KST.format(date);
}

/** 오늘 고정 일정의 총 차지 시간(시간 단위, 겹침 병합). */
export function calcBlockedHours(schedules: Schedule[]): number {
  const todayStr = toKstDateStr(new Date());

  const intervals = schedules
    .filter((s) => {
      const d = s.date instanceof Date ? s.date : new Date(s.date);
      return toKstDateStr(d) === todayStr;
    })
    .map((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return [sh * 60 + sm, eh * 60 + em] as [number, number];
    })
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let totalMinutes = 0;
  let mergedStart = -1;
  let mergedEnd = -1;

  for (const [start, end] of intervals) {
    if (mergedEnd < 0 || start > mergedEnd) {
      if (mergedEnd >= 0) totalMinutes += mergedEnd - mergedStart;
      mergedStart = start;
      mergedEnd = end;
    } else {
      mergedEnd = Math.max(mergedEnd, end);
    }
  }
  if (mergedEnd >= 0) totalMinutes += mergedEnd - mergedStart;

  return Math.round((totalMinutes / 60) * 10) / 10;
}
