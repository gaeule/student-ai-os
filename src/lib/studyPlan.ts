import { differenceInDays } from "date-fns";
import type { Assignment, Difficulty, Exam, ExamType, AssignmentStatus } from "@/types";

// KST 날짜 문자열 ("yyyy-MM-dd")
const KST_FORMAT = new Intl.DateTimeFormat("sv", { timeZone: "Asia/Seoul" });
function toKstDateStr(date: Date): string { return KST_FORMAT.format(date); }

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
  actualMinutes: number;     // 지금까지 누적 수행 시간 (분)
  requestedMinutes: number;  // 남은 시간 (estimatedHours*60 - actualMinutes)
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

export type FuturePlanBlock = {
  assignmentId: string;
  title: string;
  subjectName: string | null;
  dueDate: Date;
  allocatedMinutes: number;
};

export type FuturePlanItem = {
  date: Date;
  dateStr: string;         // KST "yyyy-MM-dd"
  daysFromToday: number;
  blocks: FuturePlanBlock[];
  totalMinutes: number;
};

export type UnplacedWarning = {
  assignmentId: string;
  title: string;
  dueDate: Date;
  daysLeft: number;
  unplacedMinutes: number;
};

export type DailyPlanResult = {
  scheduled: StudyBlock[];
  overflow: StudyBlock[];
  overdue: OverdueAssignment[];
  futurePlan: FuturePlanItem[];
  unplacedWarnings: UnplacedWarning[];
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
// W6: 못 끝낸 작업 자동 재배치
// ============================================================

/** 날짜별 전체 배치 상한 (분). 과제 10개가 같은 날에 몰리는 것을 방지. */
const MAX_DAILY_TOTAL_MINUTES = 180;

/**
 * overflow 과제 블록의 남은 시간을 마감일까지 분산 배치.
 * - 시험 블록·마감 초과 제외
 * - 과제별 하루 최대 60분, 날짜 전체 합산 최대 180분
 * - 10분 단위 내림 (floor) — 표시값과 차감량 일치
 * - 마감이 가까운 과제 우선
 * - 마감 전에 다 배치 못하면 unplacedWarnings
 */
function buildFuturePlan(
  overflow: StudyBlock[],
  today: Date
): { futurePlan: FuturePlanItem[]; unplacedWarnings: UnplacedWarning[] } {
  const assignmentBlocks = overflow
    .filter((b): b is AssignmentStudyBlock => b.type === "assignment" && b.remainingMinutes > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const dayMap = new Map<string, FuturePlanItem>();
  const unplacedWarnings: UnplacedWarning[] = [];

  for (const block of assignmentBlocks) {
    let remaining = block.remainingMinutes;
    const dueDaysLeft = block.daysLeft;

    if (dueDaysLeft <= 0) {
      unplacedWarnings.push({
        assignmentId: block.assignmentId,
        title: block.title,
        dueDate: block.dueDate,
        daysLeft: block.daysLeft,
        unplacedMinutes: remaining,
      });
      continue;
    }

    for (let dayOffset = 1; dayOffset <= dueDaysLeft && remaining > 0; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = toKstDateStr(date);

      // 날짜별 전체 상한 확인
      const existingTotal = dayMap.get(dateStr)?.totalMinutes ?? 0;
      const dayAvailable = Math.max(0, MAX_DAILY_TOTAL_MINUTES - existingTotal);

      // 과제별 60분, 날짜 전체 상한, 남은 시간 중 최솟값
      const toAllocate = Math.min(60, remaining, dayAvailable);
      if (toAllocate < 10) continue; // 이 날엔 블록을 추가할 수 없음

      // P3: floor로 내림 — 표시값 = 차감량 (오버버짓 없음)
      const allocatedMinutes = Math.floor(toAllocate / 10) * 10;
      remaining -= allocatedMinutes;

      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { date, dateStr, daysFromToday: dayOffset, blocks: [], totalMinutes: 0 });
      }
      const dayItem = dayMap.get(dateStr)!;
      dayItem.blocks.push({
        assignmentId: block.assignmentId,
        title: block.title,
        subjectName: block.subjectName,
        dueDate: block.dueDate,
        allocatedMinutes,
      });
      dayItem.totalMinutes += allocatedMinutes;
    }

    if (remaining > 0) {
      unplacedWarnings.push({
        assignmentId: block.assignmentId,
        title: block.title,
        dueDate: block.dueDate,
        daysLeft: block.daysLeft,
        unplacedMinutes: remaining,
      });
    }
  }

  const futurePlan = Array.from(dayMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  return { futurePlan, unplacedWarnings };
}

// ============================================================
// Main entry point
// ============================================================

export function buildDailyPlan(
  assignments: Assignment[],
  exams: Exam[],
  availableHours: number
): DailyPlanResult {
  // KST 기준 오늘 자정 — Vercel(UTC)에서도 한국 날짜 기준으로 계산
  const kstDateStr = KST_FORMAT.format(new Date()); // "yyyy-MM-dd" in KST
  const [ky, km, kd] = kstDateStr.split("-").map(Number);
  const today = new Date(ky, km - 1, kd); // 로컬 자정으로 생성 (differenceInDays 기준점)
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
    .flatMap((a) => {
      const totalMinutes = Math.round(a.estimatedHours * 60);
      const isOverEstimate = a.actualMinutes >= totalMinutes;
      // 최소 10분은 유지 — 제외 기준은 status === "done"만
      const requestedMinutes = Math.max(10, totalMinutes - a.actualMinutes);

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
      if (isOverEstimate) reasons.push("예상 시간 초과 · 완료 여부 확인 필요");
      else if (a.actualMinutes > 0) reasons.push(`${a.actualMinutes}분 진행됨`);

      return [{
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
        actualMinutes: a.actualMinutes,
        requestedMinutes,
        allocatedMinutes: 0,
        remainingMinutes: requestedMinutes,
        reasons,
        prioritySummary: assignmentPrioritySummary(daysLeft, a.difficulty, conflictLabel, a.estimatedHours),
        bucket,
        score,
      }];
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
  const finalOverflow = [...partialOverflow, ...overflow];

  // W6: 못 끝낸 과제 자동 재배치
  const { futurePlan, unplacedWarnings } = buildFuturePlan(finalOverflow, today);

  return { scheduled, overflow: finalOverflow, overdue, futurePlan, unplacedWarnings };
}
