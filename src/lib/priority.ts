import { differenceInDays } from "date-fns";
import type { Assignment, Difficulty, Exam } from "@/types";

// ---- 스코어 가중치 ----
const W_URGENCY    = 0.60; // 마감일 임박도 (시험 충돌 시 effective urgency 사용)
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

/**
 * 시험 충돌 감지: 과제 마감일이 시험 준비 기간 안에 있으면
 * 준비 시작일 기준 긴급도와 reason label을 반환.
 * 충돌 없으면 score = 0, label = null.
 */
function examConflict(
  daysLeftToAssignment: number,
  exams: Exam[],
  today: Date
): { effectiveUrgency: number; label: string | null } {
  let maxUrgency = 0;
  let label: string | null = null;

  for (const exam of exams) {
    const daysToExam = differenceInDays(exam.examDate, today);
    if (daysToExam < 0) continue; // 지난 시험 무시

    const daysToExamPrepStart = daysToExam - exam.prepDays;

    // 과제 마감일이 시험 준비 기간 내에 포함되는 경우
    if (daysLeftToAssignment >= daysToExamPrepStart && daysLeftToAssignment <= daysToExam) {
      // 준비 시작일까지 남은 일수로 실제 여유 시간을 계산
      const effectiveDays = Math.max(0, daysToExamPrepStart);
      const u = urgencyScore(effectiveDays);
      if (u > maxUrgency) {
        maxUrgency = u;
        const examLabel = exam.subjectName ? `${exam.subjectName} 시험` : "시험";
        label = `${examLabel} 전 완료 권장`;
      }
    }
  }

  return { effectiveUrgency: maxUrgency, label };
}

export type ScoredAssignment = Assignment & {
  score: number;
  daysLeft: number;
  allocatedHours: number; // 오늘 실제로 배정된 시간
  reasons: string[];      // 추천 이유 텍스트
};

/** 과제 목록 + 시험 일정 + 가용 시간 → 오늘 할 일 추천 목록 */
export function recommend(
  assignments: Assignment[],
  exams: Exam[],
  availableHours: number
): ScoredAssignment[] {
  const today = new Date();

  const scored = assignments
    .filter((a) => a.status !== "done")
    .map((a) => {
      const daysLeft = differenceInDays(a.dueDate, today);

      // 시험 충돌 감지
      const { effectiveUrgency, label: conflictLabel } = examConflict(daysLeft, exams, today);
      // effective urgency: 원래 긴급도 vs 시험 충돌 긴급도 중 높은 값
      const effectiveDaysUrgency = Math.max(urgencyScore(daysLeft), effectiveUrgency);

      const score =
        effectiveDaysUrgency               * W_URGENCY +
        DIFFICULTY_SCORE[a.difficulty]     * W_DIFFICULTY +
        hoursScore(a.estimatedHours)       * W_HOURS;

      const reasons: string[] = [];
      if (daysLeft <= 0)       reasons.push("마감 초과");
      else if (daysLeft <= 1)  reasons.push("오늘 마감");
      else if (daysLeft <= 3)  reasons.push(`${daysLeft}일 남음`);
      if (conflictLabel)       reasons.push(conflictLabel);
      if (a.difficulty === "hard")  reasons.push("난이도 높음 — 분산 작업 필요");
      if (a.estimatedHours <= 1.5)  reasons.push("단기 완료 가능");

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
