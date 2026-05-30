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

export type Assignment = {
  id: string;
  title: string;
  subject: string;
  dueDate: Date;
  difficulty: Difficulty;
  estimatedHours: number;
  status: AssignmentStatus;
  createdAt: Date;
};
