import type { Assignment } from "@/types";

// TODO: W2에서 Supabase로 교체 (현재 미사용)
const today = new Date();
const d = (offsetDays: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offsetDays);
  return date;
};

export const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "1",
    title: "자료구조 과제 - 이진탐색트리 구현",
    subjectId: null,
    subjectName: "알고리즘",
    dueDate: d(1),
    difficulty: "hard",
    estimatedHours: 6,
    status: "in_progress",
    createdAt: d(-3),
  },
  {
    id: "2",
    title: "운영체제 보고서 작성",
    subjectId: null,
    subjectName: "운영체제",
    dueDate: d(3),
    difficulty: "medium",
    estimatedHours: 3,
    status: "todo",
    createdAt: d(-1),
  },
  {
    id: "3",
    title: "DB 정규화 실습",
    subjectId: null,
    subjectName: "데이터베이스",
    dueDate: d(7),
    difficulty: "medium",
    estimatedHours: 4,
    status: "todo",
    createdAt: d(-2),
  },
  {
    id: "4",
    title: "소켓 프로그래밍 과제",
    subjectId: null,
    subjectName: "네트워크",
    dueDate: d(10),
    difficulty: "hard",
    estimatedHours: 8,
    status: "todo",
    createdAt: d(-1),
  },
  {
    id: "5",
    title: "요구사항 명세서 작성",
    subjectId: null,
    subjectName: "소프트웨어공학",
    dueDate: d(14),
    difficulty: "easy",
    estimatedHours: 2,
    status: "todo",
    createdAt: d(0),
  },
];
