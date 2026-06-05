import { describe, it, expect } from "vitest";
import { buildDailyPlan, calcExamRequestedMinutes, calcExamTimeCap } from "./studyPlan";
import type { Assignment, Exam } from "@/types";

// ---- 헬퍼: 오늘 자정 기준 N일 뒤 Date ----
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

const baseAssignment: Assignment = {
  id: "a1",
  title: "과제1",
  subjectId: null,
  subjectName: null,
  dueDate: daysFromNow(3),
  difficulty: "medium",
  estimatedHours: 1,
  status: "todo",
  completedAt: null,
  createdAt: new Date(),
};

const baseExam: Exam = {
  id: "e1",
  subjectId: null,
  subjectName: "자료구조",
  examType: "midterm",
  examDate: daysFromNow(3),
  scope: "1~5장",
  prepDays: 5,
  createdAt: new Date(),
};

// ============================================================
// calcExamRequestedMinutes
// ============================================================
describe("calcExamRequestedMinutes", () => {
  it("시험 당일(0)에는 midterm 기준 30분 요청", () => {
    // 30 * 1.0 = 30 → round(30/10)*10 = 30
    expect(calcExamRequestedMinutes(0, "midterm")).toBe(30);
  });

  it("시험 1일 전에는 midterm 기준 60분 요청", () => {
    // 60 * 1.0 = 60 → 60
    expect(calcExamRequestedMinutes(1, "midterm")).toBe(60);
  });

  it("시험 2~3일 전에는 midterm 기준 50분 요청 (45 → 10분 단위 반올림)", () => {
    // 45 * 1.0 = 45 → Math.round(45/10)*10 = Math.round(4.5)*10 = 5*10 = 50
    expect(calcExamRequestedMinutes(2, "midterm")).toBe(50);
    expect(calcExamRequestedMinutes(3, "midterm")).toBe(50);
  });

  it("4일+ (준비 기간 안)에는 midterm 기준 30분 요청", () => {
    // 30 * 1.0 = 30 → 30
    expect(calcExamRequestedMinutes(4, "midterm")).toBe(30);
  });

  it("quiz는 0.7배 적용 (1일 전: 60*0.7=42 → 40분)", () => {
    // Math.round(42/10)*10 = Math.round(4.2)*10 = 4*10 = 40
    expect(calcExamRequestedMinutes(1, "quiz")).toBe(40);
  });

  it("practical은 1.2배 적용 (1일 전: 60*1.2=72 → 70분)", () => {
    // Math.round(72/10)*10 = Math.round(7.2)*10 = 7*10 = 70
    expect(calcExamRequestedMinutes(1, "practical")).toBe(70);
  });

  it("최대 90분을 넘지 않는다", () => {
    // 설령 큰 값이 계산되어도 90 이하
    expect(calcExamRequestedMinutes(1, "practical")).toBeLessThanOrEqual(90);
    expect(calcExamRequestedMinutes(0, "practical")).toBeLessThanOrEqual(90);
  });
});

// ============================================================
// calcExamTimeCap
// ============================================================
describe("calcExamTimeCap", () => {
  it("시험 당일(0): 100% 허용", () => {
    expect(calcExamTimeCap(120, 0)).toBe(120);
  });

  it("시험 1일 전(1): 70% 제한", () => {
    expect(calcExamTimeCap(120, 1)).toBe(84);
  });

  it("그 외(2+): 50% 제한", () => {
    expect(calcExamTimeCap(120, 3)).toBe(60);
    expect(calcExamTimeCap(100, 5)).toBe(50);
  });
});

// ============================================================
// buildDailyPlan — 9가지 핵심 시나리오
// ============================================================
describe("buildDailyPlan", () => {

  it("1. 준비 기간 밖의 시험은 복습 블록을 생성하지 않는다", () => {
    // daysToExam=10 > prepDays=3 → 블록 없음
    const examOutside: Exam = { ...baseExam, examDate: daysFromNow(10), prepDays: 3 };
    const result = buildDailyPlan([], [examOutside], 3);
    const allBlocks = [...result.scheduled, ...result.overflow];
    expect(allBlocks.filter((b) => b.type === "exam")).toHaveLength(0);
  });

  it("2. 준비 기간 안의 시험은 복습 블록을 생성한다", () => {
    // daysToExam=3 <= prepDays=5 → 블록 생성
    const examInside: Exam = { ...baseExam, examDate: daysFromNow(3), prepDays: 5 };
    const result = buildDailyPlan([], [examInside], 3);
    const allBlocks = [...result.scheduled, ...result.overflow];
    expect(allBlocks.filter((b) => b.type === "exam").length).toBeGreaterThanOrEqual(1);
  });

  it("3. 지난 시험은 추천에서 제외된다", () => {
    const pastExam: Exam = { ...baseExam, examDate: daysFromNow(-1) };
    const result = buildDailyPlan([], [pastExam], 3);
    const allBlocks = [...result.scheduled, ...result.overflow];
    expect(allBlocks.filter((b) => b.type === "exam")).toHaveLength(0);
    expect(result.overdue).toHaveLength(0);
  });

  it("4. 오늘 마감 과제가 시험 복습(준비 기간, 3일 남음)보다 먼저 배정된다", () => {
    const todayAssignment: Assignment = { ...baseAssignment, id: "today", dueDate: daysFromNow(0) };
    const examIn3Days: Exam = { ...baseExam, examDate: daysFromNow(3), prepDays: 5 };
    const result = buildDailyPlan([todayAssignment], [examIn3Days], 5);
    const scheduled = result.scheduled;
    const assignIdx = scheduled.findIndex((b) => b.type === "assignment");
    const examIdx = scheduled.findIndex((b) => b.type === "exam");
    expect(assignIdx).toBeGreaterThanOrEqual(0);
    expect(examIdx).toBeGreaterThanOrEqual(0);
    expect(assignIdx).toBeLessThan(examIdx);
  });

  it("5. 내일 시험 복습(bucket 0.8)은 내일 마감 과제(bucket 1)보다 먼저 배정된다", () => {
    const tomorrowAssignment: Assignment = { ...baseAssignment, id: "tmr", dueDate: daysFromNow(1) };
    const tomorrowExam: Exam = { ...baseExam, id: "tmrExam", examDate: daysFromNow(1), prepDays: 5 };
    const result = buildDailyPlan([tomorrowAssignment], [tomorrowExam], 5);
    const scheduled = result.scheduled;
    const examIdx = scheduled.findIndex((b) => b.type === "exam");
    const assignIdx = scheduled.findIndex((b) => b.type === "assignment");
    expect(examIdx).toBeGreaterThanOrEqual(0);
    expect(assignIdx).toBeGreaterThanOrEqual(0);
    // 시험 복습 bucket 0.8 < 과제 bucket 1
    expect(examIdx).toBeLessThan(assignIdx);
  });

  it("6. 시험 복습 시간이 일일 상한을 넘지 않는다 (2시간 가용 → 50% = 60분)", () => {
    const examIn3Days: Exam = { ...baseExam, examDate: daysFromNow(3), prepDays: 5 };
    const result = buildDailyPlan([], [examIn3Days], 2); // 120분 가용, cap=60분
    const examScheduled = result.scheduled.filter((b) => b.type === "exam");
    const totalExamMinutes = examScheduled.reduce((s, b) => s + b.allocatedMinutes, 0);
    expect(totalExamMinutes).toBeLessThanOrEqual(60);
  });

  it("7. 마감 초과 과제는 overdue 배열로 분리된다", () => {
    const overdueAssignment: Assignment = { ...baseAssignment, id: "over", dueDate: daysFromNow(-2) };
    const result = buildDailyPlan([overdueAssignment], [], 3);
    expect(result.overdue).toHaveLength(1);
    expect(result.scheduled.filter((b) => b.type === "assignment")).toHaveLength(0);
  });

  it("8. 가용 시간 0시간이면 시험 복습도 overflow로 간다", () => {
    const tomorrowExam: Exam = { ...baseExam, examDate: daysFromNow(1), prepDays: 5 };
    const result = buildDailyPlan([], [tomorrowExam], 0);
    expect(result.scheduled.filter((b) => b.type === "exam")).toHaveLength(0);
    expect(result.overflow.filter((b) => b.type === "exam").length).toBeGreaterThanOrEqual(1);
  });

  it("9. 시험 복습 블록 추가 후에도 overdue 분리가 유지된다", () => {
    const overdueAssignment: Assignment = { ...baseAssignment, id: "over", dueDate: daysFromNow(-1) };
    const examIn2Days: Exam = { ...baseExam, examDate: daysFromNow(2), prepDays: 5 };
    const result = buildDailyPlan([overdueAssignment], [examIn2Days], 3);
    expect(result.overdue).toHaveLength(1);
    expect(result.overdue[0].daysLeft).toBeLessThan(0);
    // 시험 블록은 scheduled 또는 overflow에 있어야 함
    const allBlocks = [...result.scheduled, ...result.overflow];
    expect(allBlocks.filter((b) => b.type === "exam").length).toBeGreaterThanOrEqual(1);
  });
});
