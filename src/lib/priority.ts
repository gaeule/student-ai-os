import { differenceInDays } from "date-fns";
import type { Assignment, Difficulty, Exam } from "@/types";

// ---- 스코어 가중치 ----
const W_URGENCY    = 0.60;
const W_DIFFICULTY = 0.25;
const W_HOURS      = 0.15;

const DIFFICULTY_SCORE: Record<Difficulty, number> = {
  hard:   100,
  medium:  60,
  easy:    20,
};

/**
 * 마감까지 남은 날 수를 0~4 버킷으로 분류.
 * 버킷 숫자가 작을수록 우선순위 높음.
 * daysLeft < 0 (마감 초과)는 호출하지 않는다 — overdue 배열로 별도 처리.
 */
function deadlineBucket(daysLeft: number): number {
  if (daysLeft === 0) return 0; // 오늘 마감
  if (daysLeft === 1) return 1; // 내일 마감
  if (daysLeft <= 3)  return 2; // 2~3일 남음
  if (daysLeft <= 7)  return 3; // 4~7일 남음
  return 4;                      // 8일 이상 여유
}

function urgencyScore(daysLeft: number): number {
  if (daysLeft === 0) return 100;
  if (daysLeft === 1) return  92;
  if (daysLeft === 2) return  80;
  if (daysLeft <= 4)  return  60;
  if (daysLeft <= 7)  return  35;
  if (daysLeft <= 14) return  15;
  return 5;
}

function hoursScore(estimatedHours: number): number {
  if (estimatedHours <= 1)  return 100;
  if (estimatedHours <= 2)  return  80;
  if (estimatedHours <= 4)  return  55;
  if (estimatedHours <= 6)  return  30;
  return 10;
}

function examConflict(
  daysLeftToAssignment: number,
  exams: Exam[],
  today: Date
): { effectiveUrgency: number; label: string | null } {
  let maxUrgency = 0;
  let label: string | null = null;

  for (const exam of exams) {
    const daysToExam = differenceInDays(exam.examDate, today);
    if (daysToExam < 0) continue;

    const daysToExamPrepStart = daysToExam - exam.prepDays;

    if (daysLeftToAssignment >= daysToExamPrepStart && daysLeftToAssignment <= daysToExam) {
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

/** 추천 이유를 한 문장으로 요약 (daysLeft >= 0 인 활성 과제 전용) */
function buildPrioritySummary(
  daysLeft: number,
  difficulty: Difficulty,
  conflictLabel: string | null,
  estimatedHours: number
): string {
  if (daysLeft === 0) return "오늘이 마감일입니다 — 지금 바로 시작하세요";
  if (daysLeft === 1 && difficulty === "hard") return "내일 마감이고 난이도가 높습니다 — 오늘 안에 완료하세요";
  if (daysLeft === 1) return "내일 마감됩니다 — 오늘 안에 처리하세요";
  if (daysLeft === 2 && difficulty === "hard") return "이틀 남았고 난이도가 높아 오늘 반드시 시작해야 합니다";
  if (daysLeft === 2) return "이틀 안에 마감됩니다 — 오늘 안에 처리하는 게 안전합니다";
  if (conflictLabel)  return `${conflictLabel} — 시험 준비 시작 전에 끝내야 합니다`;
  if (difficulty === "hard" && daysLeft <= 5) return `${daysLeft}일 남았지만 난이도가 높아 오늘부터 분산 작업을 권장합니다`;
  if (estimatedHours <= 1.5) return "소요 시간이 짧아 오늘 바로 끝낼 수 있습니다";
  if (daysLeft <= 7)  return `${daysLeft}일 안에 마감 — 오늘 일부라도 진행하면 여유가 생깁니다`;
  return `마감 ${daysLeft}일 전 — 미리 시작하면 여유롭게 완성할 수 있습니다`;
}

export type ScoredAssignment = Assignment & {
  score: number;
  daysLeft: number;
  bucket: number;           // 마감 버킷 (0=오늘, 1=내일, 2=2~3일, 3=4~7일, 4=여유, 99=마감초과)
  allocatedHours: number;   // 오늘 배정된 시간
  remainingHours: number;   // 아직 남은 시간 (estimatedHours - allocatedHours)
  reasons: string[];
  prioritySummary: string;
};

export type RecommendResult = {
  scheduled: ScoredAssignment[]; // 오늘 시간 배정된 과제
  overflow: ScoredAssignment[];  // 시간 부족으로 오늘 못 한 과제 (부분 배정 포함)
  overdue: ScoredAssignment[];   // 마감 초과 — 별도 확인 필요, 추천 배정에서 제외
};

export function recommend(
  assignments: Assignment[],
  exams: Exam[],
  availableHours: number
): RecommendResult {
  const today = new Date();
  const nonDone = assignments.filter((a) => a.status !== "done");

  // ---- 마감 초과 분리 ----
  const overdueRaw = nonDone.filter(
    (a) => differenceInDays(a.dueDate, today) < 0
  );
  const activeRaw  = nonDone.filter(
    (a) => differenceInDays(a.dueDate, today) >= 0
  );

  // ---- 마감 초과: 점수 계산 후 overdue 배열로 반환 (배정 없음) ----
  const overdue: ScoredAssignment[] = overdueRaw.map((a) => {
    const daysLeft = differenceInDays(a.dueDate, today); // 음수
    return {
      ...a,
      score: 0,
      daysLeft,
      bucket: 99,
      allocatedHours: 0,
      remainingHours: a.estimatedHours,
      reasons: ["마감 초과"],
      prioritySummary: "마감이 지났습니다 — 제출 가능 여부를 먼저 확인하세요",
    };
  });

  // ---- 활성 과제: 버킷 + 점수 계산 ----
  const scored = activeRaw
    .map((a) => {
      const daysLeft = differenceInDays(a.dueDate, today);
      const bucket = deadlineBucket(daysLeft);
      const { effectiveUrgency, label: conflictLabel } = examConflict(daysLeft, exams, today);
      const effectiveDaysUrgency = Math.max(urgencyScore(daysLeft), effectiveUrgency);

      const score =
        effectiveDaysUrgency               * W_URGENCY +
        DIFFICULTY_SCORE[a.difficulty]     * W_DIFFICULTY +
        hoursScore(a.estimatedHours)       * W_HOURS;

      const reasons: string[] = [];
      if (daysLeft === 0)       reasons.push("오늘 마감");
      else if (daysLeft === 1)  reasons.push("내일 마감");
      else if (daysLeft <= 3)   reasons.push(`${daysLeft}일 남음`);
      if (conflictLabel)        reasons.push(conflictLabel);
      if (a.difficulty === "hard")  reasons.push("난이도 높음");
      if (a.estimatedHours <= 1.5)  reasons.push("단기 완료 가능");

      const prioritySummary = buildPrioritySummary(daysLeft, a.difficulty, conflictLabel, a.estimatedHours);

      return { ...a, score, daysLeft, bucket, allocatedHours: 0, remainingHours: a.estimatedHours, reasons, prioritySummary };
    })
    // 버킷 우선, 같은 버킷 안에서는 점수 내림차순
    .sort((a, b) => {
      const bucketDiff = a.bucket - b.bucket;
      if (bucketDiff !== 0) return bucketDiff;
      return b.score - a.score;
    });

  // ---- 탐욕 시간 배정 ----
  let remaining = availableHours;
  const scheduled: ScoredAssignment[] = [];
  const overflow: ScoredAssignment[] = [];

  for (const a of scored) {
    if (remaining > 0) {
      const allocated = Math.min(a.estimatedHours, remaining);
      scheduled.push({ ...a, allocatedHours: allocated, remainingHours: a.estimatedHours - allocated });
      remaining -= allocated;
    } else {
      overflow.push(a);
    }
  }

  // 부분 배정된 과제의 남은 시간도 내일 플랜에 표시
  const partialOverflow = scheduled.filter((a) => a.allocatedHours < a.estimatedHours);

  return { scheduled, overflow: [...partialOverflow, ...overflow], overdue };
}
