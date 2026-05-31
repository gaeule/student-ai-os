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

export type Assignment = {
  id: string;
  title: string;
  subjectId: string | null;
  subjectName: string | null;
  dueDate: Date;
  difficulty: Difficulty;
  estimatedHours: number;
  status: AssignmentStatus;
  createdAt: Date;
};
