"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Assignment, Difficulty, AssignmentStatus } from "@/types";

function fromDb(row: Record<string, unknown>): Assignment {
  const subjects = row.subjects as { name: string } | null;
  return {
    id: row.id as string,
    title: row.title as string,
    subjectId: (row.subject_id as string | null) ?? null,
    subjectName: subjects?.name ?? null,
    dueDate: new Date(row.due_date as string),
    difficulty: row.difficulty as Difficulty,
    estimatedHours: Number(row.estimated_hours),
    status: row.status as AssignmentStatus,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function getAssignments(): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*, subjects(name)")
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDb);
}

export async function createAssignment(
  input: Pick<Assignment, "title" | "subjectId" | "dueDate" | "difficulty" | "estimatedHours">
): Promise<{ data: Assignment | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      title: input.title,
      subject_id: input.subjectId ?? null,
      due_date: input.dueDate.toISOString().split("T")[0],
      difficulty: input.difficulty,
      estimated_hours: input.estimatedHours,
    })
    .select("*, subjects(name)")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { data: fromDb(data), error: null };
}

export async function updateAssignment(
  id: string,
  input: Pick<Assignment, "title" | "subjectId" | "dueDate" | "difficulty" | "estimatedHours">
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("assignments")
    .update({
      title: input.title,
      subject_id: input.subjectId ?? null,
      due_date: input.dueDate.toISOString().split("T")[0],
      difficulty: input.difficulty,
      estimated_hours: input.estimatedHours,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("assignments")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteAssignment(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  return { error: null };
}
