export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type User = {
  name: string;
  email: string;
  avatarUrl?: string;
};

export type Difficulty = "hard" | "medium" | "easy";
export type AssignmentStatus = "todo" | "in_progress" | "done";

export type Subject = {
  id: string;
  name: string;
  professor: string | null;
  semester: string | null;
  createdAt: Date;
};

export type ExamType = "midterm" | "final" | "quiz" | "practical";

export type Exam = {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  examType: ExamType;
  examDate: Date;
  scope: string | null;
  prepDays: number;
  createdAt: Date;
};

export type ScheduleCategory = "수업" | "알바" | "동아리" | "병원" | "약속" | "기타";

export type Schedule = {
  id: string;
  title: string;
  date: Date;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  category: ScheduleCategory;
  memo: string | null;
  createdAt: Date;
};

export type Assignment = {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  dueDate: Date;
  difficulty: Difficulty;
  estimatedHours: number;
  status: AssignmentStatus;
  completedAt: Date | null;
  createdAt: Date;
};
