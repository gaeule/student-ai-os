"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Assignment, Difficulty, AssignmentStatus } from "@/types";

// ---- DB row → Assignment 변환 ----
// DB: snake_case / App: camelCase + Date 객체
function fromDb(row: Record<string, unknown>): Assignment {
  return {
    id: row.id as string,
    title: row.title as string,
    subject: row.subject as string,
    dueDate: new Date(row.due_date as string),
    difficulty: row.difficulty as Difficulty,
    estimatedHours: Number(row.estimated_hours),
    status: row.status as AssignmentStatus,
    createdAt: new Date(row.created_at as string),
  };
}

// ---- 조회 ----
export async function getAssignments(): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDb);
}

// ---- 등록 ----
export async function createAssignment(
  input: Pick<Assignment, "title" | "subject" | "dueDate" | "difficulty" | "estimatedHours">
): Promise<{ data: Assignment | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      title: input.title,
      subject: input.subject,
      due_date: input.dueDate.toISOString().split("T")[0], // YYYY-MM-DD
      difficulty: input.difficulty,
      estimated_hours: input.estimatedHours,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { data: fromDb(data), error: null };
}

// ---- 상태 수정 ----
export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { error: null };
}

// ---- 삭제 ----
export async function deleteAssignment(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { error: null };
}
