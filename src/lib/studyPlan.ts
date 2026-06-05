import { differenceInDays } from "date-fns";
import type { Assignment, Difficulty, Exam, ExamType, AssignmentStatus } from "@/types";

// ============================================================
// Types
// ============================================================

/** 마감이 지난 과제 — 시간 배정 없이 별도 확인 필요. */
export type OverdueAssignment = Assignment & {
  score: number;
  daysLeft: number;       // 음수 (마감 초과일 수)
  bucket: 99;
  allocatedHours: 0;
  remainingHours: number;
  reasons: string[];
  prioritySummary: string;
};

export type AssignmentStudyBlock = {
  type: "assignment";
  id: string;
  assignmentId: string;
  title: string;
  subjectName: string | null;
  dueDate: Date;
  daysLeft: number;
  difficulty: Difficulty;
  status: AssignmentStatus;
  estimatedHours: number;
  requestedMinutes: number;
  allocatedMinutes: number;
  remainingMinutes: number;
  reasons: string[];
  prioritySummary: string;
  bucket: number;
  score: number;
};

export type ExamStudyBlock = {
  type: "exam";
  id: string;
  examId: string;
  title: string;
  subjectName: string | null;
  examDate: Date;
  daysLeft: number;   // daysToExam
  examType: ExamType;
  scope: string | null;
  requestedMinutes: number;
  allocatedMinutes: number;
  remainingMinutes: number;
  prioritySummary: string;
  bucket: number;
  score: number;
};

export type StudyBlock = AssignmentStudyBlock | ExamStudyBlock;

export type DailyPlanResult = {
  scheduled: StudyBlock[];
  overflow: StudyBlock[];
  overdue: OverdueAssignment[];
};

// ============================================================
// Internal helpers
// ============================================================

/** 과제 마감 버킷 (기존 priority.ts와 동일) */
function assignmentBucket(daysLeft: number): number {
  if (daysLeft === 0) return 0;
  if (daysLeft === 1) return 1;
  if (daysLeft <= 3)  return 2;
  if (daysLeft <= 7)  return 3;
  return 4;
}

/**
 * 시험 복습 버킷 — 과제 버킷 사이에 끼워 넣는다.
 * 0.5: 오늘 시험 (오늘 마감 과제 다음, 내일 시험 전)
 * 0.8: 내일 시험 (오늘 시험 다음, 내일 마감 과제 전)
 * 1.5: 준비 기간 (내일 마감 과제 다음, 2일+ 과제 전)
 */
function examBucket(daysToExam: number): number {
  if (daysToExam === 0) return 0.5;
  if (daysToExam === 1) return 0.8;
  return 1.5;
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

const DIFFICULTY_SCORE: Record<Difficulty, number> = {
  hard: 100, medium: 60, easy: 20,
};

function hoursScore(estimatedHours: number): number {
  if (estimatedHours <= 1)  return 100;
  if (estimatedHours <= 2)  return  80;
  if (estimatedHours <= 4)  return  55;
  if (estimatedHours <= 6)  return  30;
  return 10;
}

function examConflictForAssignment(
  daysLeftToAssignment: number,
  exams: Exam[],
  today: Date
): { effectiveUrgency: number; label: string | null } {
  let maxUrgency = 0;
  let label: string | null = null;
  for (const exam of exams) {
    const daysToExam = differenceInDays(exam.examDate, today);
    if (daysToExam < 0) continue;
    const prepStart = daysToExam - exam.prepDays;
    if (daysLeftToAssignment >= prepStart && daysLeftToAssignment <= daysToExam) {
      const u = urgencyScore(Math.max(0, prepStart));
      if (u > maxUrgency) {
        maxUrgency = u;
        const examLabel = exam.subjectName ? `${exam.subjectName} 시험` : "시험";
        label = `${examLabel} 전 완료 권장`;
      }
    }
  }
  return { effectiveUrgency: maxUrgency, label };
}

function assignmentPrioritySummary(
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
  if (conflictLabel) return `${conflictLabel} — 시험 준비 시작 전에 끝내야 합니다`;
  if (difficulty === "hard" && daysLeft <= 5) return `${daysLeft}일 남았지만 난이도가 높아 오늘부터 분산 작업을 권장합니다`;
  if (estimatedHours <= 1.5) return "소요 시간이 짧아 오늘 바로 끝낼 수 있습니다";
  if (daysLeft <= 7) return `${daysLeft}일 안에 마감 — 오늘 일부라도 진행하면 여유가 생깁니다`;
  return `마감 ${daysLeft}일 전 — 미리 시작하면 여유롭게 완성할 수 있습니다`;
}

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm:   "중간고사",
  final:     "기말고사",
  quiz:      "퀴즈",
  practical: "실기시험",
};

const EXAM_TYPE_MULTIPLIER: Record<ExamType, number> = {
  quiz:      0.7,
  midterm:   1.0,
  final:     1.0,
  practical: 1.2,
};

// ============================================================
// Exported helpers (used in tests)
// ============================================================

/**
 * 시험 복습 요청 시간 계산.
 * - 10분 단위 반올림, 최대 90분
 */
export function calcExamRequestedMinutes(daysToExam: number, examType: ExamType): number {
  const base =
    daysToExam === 0 ? 30 :
    daysToExam === 1 ? 60 :
    daysToExam <= 3  ? 45 : 30;
  const multiplier = EXAM_TYPE_MULTIPLIER[examType];
  return Math.min(90, Math.round((base * multiplier) / 10) * 10);
}

/**
 * 시험 복습 일일 시간 상한 (분 단위).
 * 여러 시험 중 가장 급한 것 기준으로 결정.
 */
export function calcExamTimeCap(availableMinutes: number, minDaysToExam: number): number {
  if (minDaysToExam === 0) return availableMinutes;
  if (minDaysToExam === 1) return Math.round(availableMinutes * 0.7);
  return Math.round(availableMinutes * 0.5);
}

function examPrioritySummary(daysToExam: number, examType: ExamType, subjectName: string | null): string {
  const label = subjectName
    ? `${subjectName} ${EXAM_TYPE_LABEL[examType]}`
    : EXAM_TYPE_LABEL[examType];
  if (daysToExam === 0) return `${label} 당일 — 마지막 복습으로 실력을 점검하세요`;
  if (daysToExam === 1) return `${label} 내일 — 오늘 충분히 복습하면 자신감이 생깁니다`;
  if (daysToExam <= 3)  return `${label} ${daysToExam}일 전 — 꾸준한 복습으로 준비 중입니다`;
  return `${label} ${daysToExam}일 전 — 준비 기간이 시작됐습니다`;
}

// ============================================================
// Main entry point
// ============================================================

export function buildDailyPlan(
  assignments: Assignment[],
  exams: Exam[],
  availableHours: number
): DailyPlanResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const availableMinutes = Math.round(availableHours * 60);

  // ---- 마감 초과 분리 ----
  const nonDone = assignments.filter((a) => a.status !== "done");
  const overdue: OverdueAssignment[] = nonDone
    .filter((a) => differenceInDays(a.dueDate, today) < 0)
    .map((a) => ({
      ...a,
      score: 0,
      daysLeft: differenceInDays(a.dueDate, today),
      bucket: 99,
      allocatedHours: 0,
      remainingHours: a.estimatedHours,
      reasons: ["마감 초과"],
      prioritySummary: "마감이 지났습니다 — 제출 가능 여부를 먼저 확인하세요",
    }));

  // ---- 활성 과제 → AssignmentStudyBlock ----
  const assignmentBlocks: AssignmentStudyBlock[] = nonDone
    .filter((a) => differenceInDays(a.dueDate, today) >= 0)
    .map((a) => {
      const daysLeft = differenceInDays(a.dueDate, today);
      const bucket = assignmentBucket(daysLeft);
      const { effectiveUrgency, label: conflictLabel } = examConflictForAssignment(daysLeft, exams, today);
      const effectiveDaysUrgency = Math.max(urgencyScore(daysLeft), effectiveUrgency);
      const score =
        effectiveDaysUrgency * 0.60 +
        DIFFICULTY_SCORE[a.difficulty] * 0.25 +
        hoursScore(a.estimatedHours) * 0.15;

      const reasons: string[] = [];
      if (daysLeft === 0) reasons.push("오늘 마감");
      else if (daysLeft === 1) reasons.push("내일 마감");
      else if (daysLeft <= 3) reasons.push(`${daysLeft}일 남음`);
      if (conflictLabel) reasons.push(conflictLabel);
      if (a.difficulty === "hard") reasons.push("난이도 높음");
      if (a.estimatedHours <= 1.5) reasons.push("단기 완료 가능");

      const requestedMinutes = Math.round(a.estimatedHours * 60);
      return {
        type: "assignment" as const,
        id: a.id,
        assignmentId: a.id,
        title: a.title,
        subjectName: a.subjectName,
        dueDate: a.dueDate,
        daysLeft,
        difficulty: a.difficulty,
        status: a.status,
        estimatedHours: a.estimatedHours,
        requestedMinutes,
        allocatedMinutes: 0,
        remainingMinutes: requestedMinutes,
        reasons,
        prioritySummary: assignmentPrioritySummary(daysLeft, a.difficulty, conflictLabel, a.estimatedHours),
        bucket,
        score,
      };
    });

  // ---- 시험 복습 블록 생성 ----
  const examBlocks: ExamStudyBlock[] = exams
    .map((exam) => ({ exam, daysToExam: differenceInDays(exam.examDate, today) }))
    .filter(({ daysToExam, exam }) => daysToExam >= 0 && daysToExam <= exam.prepDays)
    .sort((a, b) => a.daysToExam - b.daysToExam) // 급한 시험부터
    .map(({ exam, daysToExam }) => {
      const requestedMinutes = calcExamRequestedMinutes(daysToExam, exam.examType);
      const bucket = examBucket(daysToExam);
      const score = urgencyScore(daysToExam);
      const title = exam.subjectName
        ? `${exam.subjectName} ${EXAM_TYPE_LABEL[exam.examType]} 복습`
        : `${EXAM_TYPE_LABEL[exam.examType]} 복습`;
      return {
        type: "exam" as const,
        id: exam.id,
        examId: exam.id,
        title,
        subjectName: exam.subjectName,
        examDate: exam.examDate,
        daysLeft: daysToExam,
        examType: exam.examType,
        scope: exam.scope,
        requestedMinutes,
        allocatedMinutes: 0,
        remainingMinutes: requestedMinutes,
        prioritySummary: examPrioritySummary(daysToExam, exam.examType, exam.subjectName),
        bucket,
        score,
      };
    });

  // ---- 시험 복습 시간 상한 ----
  const minDaysToExam = examBlocks.length > 0
    ? Math.min(...examBlocks.map((b) => b.daysLeft))
    : Infinity;
  const examTimeCap = examBlocks.length > 0
    ? calcExamTimeCap(availableMinutes, minDaysToExam)
    : 0;

  // ---- 통합 정렬: bucket 오름차순 → score 내림차순 ----
  const allBlocks: StudyBlock[] = [...assignmentBlocks, ...examBlocks].sort((a, b) => {
    const bd = a.bucket - b.bucket;
    return bd !== 0 ? bd : b.score - a.score;
  });

  // ---- 탐욕 시간 배정 (분 단위) ----
  let remainingMinutes = availableMinutes;
  let examMinutesAllocated = 0;
  const scheduled: StudyBlock[] = [];
  const overflow: StudyBlock[] = [];

  for (const block of allBlocks) {
    if (remainingMinutes <= 0) {
      overflow.push(block);
      continue;
    }
    if (block.type === "exam") {
      const canAllocate = Math.min(
        block.requestedMinutes,
        remainingMinutes,
        examTimeCap - examMinutesAllocated
      );
      if (canAllocate <= 0) {
        overflow.push(block);
        continue;
      }
      examMinutesAllocated += canAllocate;
      remainingMinutes -= canAllocate;
      scheduled.push({ ...block, allocatedMinutes: canAllocate, remainingMinutes: block.requestedMinutes - canAllocate });
    } else {
      const canAllocate = Math.min(block.requestedMinutes, remainingMinutes);
      remainingMinutes -= canAllocate;
      scheduled.push({ ...block, allocatedMinutes: canAllocate, remainingMinutes: block.requestedMinutes - canAllocate });
    }
  }

  // 부분 배정 항목도 내일 플랜에 포함
  const partialOverflow = scheduled.filter((b) => b.allocatedMinutes < b.requestedMinutes);

  return { scheduled, overflow: [...partialOverflow, ...overflow], overdue };
}
