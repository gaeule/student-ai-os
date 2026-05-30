import { differenceInDays } from "date-fns";
import type { Assignment, Difficulty } from "@/types";

// ---- 스코어 가중치 ----
const W_URGENCY    = 0.60; // 마감일 임박도
const W_DIFFICULTY = 0.25; // 난이도 (어려울수록 미루면 위험)
const W_HOURS      = 0.15; // 예상 소요시간 (짧을수록 먼저 처리 유리)

const DIFFICULTY_SCORE: Record<Difficulty, number> = {
  hard:   100,
  medium:  60,
  easy:    20,
};

/** 마감까지 남은 일수 → 긴급도 점수 (0~100) */
function urgencyScore(daysLeft: number): number {
  if (daysLeft <= 0)  return 100;
  if (daysLeft === 1) return  92;
  if (daysLeft === 2) return  80;
  if (daysLeft <= 4)  return  60;
  if (daysLeft <= 7)  return  35;
  if (daysLeft <= 14) return  15;
  return 5;
}

/** 예상 소요시간 → 처리 용이성 점수 (짧을수록 높음, 0~100) */
function hoursScore(estimatedHours: number): number {
  if (estimatedHours <= 1)  return 100;
  if (estimatedHours <= 2)  return  80;
  if (estimatedHours <= 4)  return  55;
  if (estimatedHours <= 6)  return  30;
  return 10;
}

export type ScoredAssignment = Assignment & {
  score: number;
  daysLeft: number;
  allocatedHours: number; // 오늘 실제로 배정된 시간
  reasons: string[];      // 추천 이유 텍스트
};

/** 과제 목록 + 가용 시간 → 오늘 할 일 추천 목록 */
export function recommend(
  assignments: Assignment[],
  availableHours: number
): ScoredAssignment[] {
  const today = new Date();

  const scored = assignments
    .filter((a) => a.status !== "done")
    .map((a) => {
      const daysLeft = differenceInDays(a.dueDate, today);
      const score =
        urgencyScore(daysLeft)            * W_URGENCY +
        DIFFICULTY_SCORE[a.difficulty]    * W_DIFFICULTY +
        hoursScore(a.estimatedHours)      * W_HOURS;

      const reasons: string[] = [];
      if (daysLeft <= 0)  reasons.push("마감 초과");
      else if (daysLeft <= 1) reasons.push("오늘 마감");
      else if (daysLeft <= 3) reasons.push(`${daysLeft}일 남음`);
      if (a.difficulty === "hard")   reasons.push("난이도 높음 — 분산 작업 필요");
      if (a.estimatedHours <= 1.5)   reasons.push("단기 완료 가능");

      return { ...a, score, daysLeft, allocatedHours: 0, reasons };
    })
    .sort((a, b) => b.score - a.score);

  // 탐욕 배정: 가용 시간을 소진하면서 순서대로 배정
  let remaining = availableHours;
  const result: ScoredAssignment[] = [];

  for (const a of scored) {
    if (remaining <= 0) break;
    const allocated = Math.min(a.estimatedHours, remaining);
    result.push({ ...a, allocatedHours: allocated });
    remaining -= allocated;
  }

  return result;
}
