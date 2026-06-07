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
  actualMinutes: 0,
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

// ============================================================
// W6: buildFuturePlan (buildDailyPlan 통해 검증)
// ============================================================
describe("W6 futurePlan", () => {

  it("1. overflow 없으면 futurePlan이 비어있다", () => {
    // 가용 시간 충분 → overflow 없음
    const result = buildDailyPlan([baseAssignment], [], 10);
    expect(result.futurePlan).toHaveLength(0);
    expect(result.unplacedWarnings).toHaveLength(0);
  });

  it("2. daysLeft=1 과제 remainingMinutes=60 → 내일(day+1) 60분 배정", () => {
    // 가용 시간 0 → 과제가 overflow로, remainingMinutes=60
    const a: Assignment = { ...baseAssignment, id: "a2", dueDate: daysFromNow(1), estimatedHours: 1 };
    const result = buildDailyPlan([a], [], 0);
    expect(result.futurePlan).toHaveLength(1);
    expect(result.futurePlan[0].daysFromToday).toBe(1);
    const block = result.futurePlan[0].blocks[0];
    expect(block.assignmentId).toBe("a2");
    expect(block.allocatedMinutes).toBeGreaterThanOrEqual(10);
  });

  it("3. daysLeft=3 과제 remainingMinutes=180 → 3일에 60분씩 분산", () => {
    const a: Assignment = { ...baseAssignment, id: "a3", dueDate: daysFromNow(3), estimatedHours: 3 };
    const result = buildDailyPlan([a], [], 0);
    expect(result.futurePlan).toHaveLength(3);
    const total = result.futurePlan.reduce((s, d) => s + d.totalMinutes, 0);
    // 각 날 60분씩 = 180분 (반올림 오차 허용)
    expect(total).toBeGreaterThanOrEqual(170);
    expect(total).toBeLessThanOrEqual(190);
    result.futurePlan.forEach((d) => {
      expect(d.blocks[0].allocatedMinutes).toBeLessThanOrEqual(60);
    });
  });

  it("4. 하루 최대 60분/과제 제한이 적용된다", () => {
    // estimatedHours=2 (120분), 가용 0 → remainingMinutes=120, daysLeft=5
    const a: Assignment = { ...baseAssignment, id: "a4", dueDate: daysFromNow(5), estimatedHours: 2 };
    const result = buildDailyPlan([a], [], 0);
    result.futurePlan.forEach((d) => {
      d.blocks.forEach((b) => {
        expect(b.allocatedMinutes).toBeLessThanOrEqual(60);
      });
    });
  });

  it("5. 10분 단위 내림(floor) — 표시값과 차감량 일치, 10의 배수", () => {
    // remaining=35 → floor(35/10)*10=30 배정, 나머지 5분은 unplacedWarnings
    const a: Assignment = {
      ...baseAssignment,
      id: "a5",
      dueDate: daysFromNow(2),
      estimatedHours: 1,
      actualMinutes: 25,  // 60-25=35 remaining
    };
    const result = buildDailyPlan([a], [], 0);
    const allAllocated = result.futurePlan.flatMap((d) => d.blocks.map((b) => b.allocatedMinutes));
    // 모든 배정값은 10의 배수
    allAllocated.forEach((m) => {
      expect(m % 10).toBe(0);
    });
    // 30분 배정 후 5분은 배치 불가 → unplacedWarnings
    expect(result.unplacedWarnings).toHaveLength(1);
    expect(result.unplacedWarnings[0].unplacedMinutes).toBe(5);
  });

  it("5b. 날짜별 전체 상한 180분 — 과제가 4개여도 하루 합산 180분 초과 안 됨", () => {
    // 4개 과제, 각 60분 남음, 모두 내일 마감 → 4번째는 unplacedWarnings
    const makeA = (id: string): Assignment => ({
      ...baseAssignment,
      id,
      dueDate: daysFromNow(1),
      estimatedHours: 1,
      actualMinutes: 0,
    });
    const result = buildDailyPlan([makeA("b1"), makeA("b2"), makeA("b3"), makeA("b4")], [], 0);
    result.futurePlan.forEach((day) => {
      expect(day.totalMinutes).toBeLessThanOrEqual(180);
    });
    // 4번째 과제는 배치 불가
    expect(result.unplacedWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("6. 시험 블록은 futurePlan에 포함되지 않는다", () => {
    const examTomorrow: Exam = { ...baseExam, examDate: daysFromNow(1), prepDays: 5 };
    const result = buildDailyPlan([], [examTomorrow], 0);
    // overflow에 시험 블록이 있어도 futurePlan에는 없어야 함
    const hasExamInFuture = result.futurePlan.some((d) =>
      // type 정보가 없으므로 assignmentId로 판단 — 시험은 examId를 가짐
      d.blocks.some((b) => b.assignmentId === baseExam.id)
    );
    expect(hasExamInFuture).toBe(false);
    expect(result.futurePlan).toHaveLength(0);
  });

  it("7. daysLeft=0(오늘 마감) 과제는 unplacedWarnings에 기록된다", () => {
    const a: Assignment = { ...baseAssignment, id: "a7", dueDate: daysFromNow(0) };
    const result = buildDailyPlan([a], [], 0);
    expect(result.unplacedWarnings).toHaveLength(1);
    expect(result.unplacedWarnings[0].assignmentId).toBe("a7");
  });

  it("8. 남은 시간이 마감 전에 다 배치되면 unplacedWarnings 없음", () => {
    // daysLeft=3, estimatedHours=3(180분) → 3일*60분 = 전부 배치 가능
    const a: Assignment = { ...baseAssignment, id: "a8", dueDate: daysFromNow(3), estimatedHours: 3 };
    const result = buildDailyPlan([a], [], 0);
    expect(result.unplacedWarnings).toHaveLength(0);
  });

  it("9. futurePlan 날짜는 오름차순으로 정렬된다", () => {
    const a: Assignment = { ...baseAssignment, id: "a9", dueDate: daysFromNow(4), estimatedHours: 4 };
    const result = buildDailyPlan([a], [], 0);
    for (let i = 1; i < result.futurePlan.length; i++) {
      expect(result.futurePlan[i].date.getTime()).toBeGreaterThan(
        result.futurePlan[i - 1].date.getTime()
      );
    }
  });
});
