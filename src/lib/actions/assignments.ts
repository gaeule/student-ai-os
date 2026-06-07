"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Assignment, Difficulty, AssignmentStatus } from "@/types";

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fromDb(row: Record<string, unknown>): Assignment {
  const subjects = row.subjects as { name: string } | null;
  return {
    id: row.id as string,
    title: row.title as string,
    subjectId: (row.subject_id as string | null) ?? null,
    subjectName: subjects?.name ?? null,
    dueDate: parseDateOnly(row.due_date as string),
    difficulty: row.difficulty as Difficulty,
    estimatedHours: Number(row.estimated_hours),
    actualMinutes: Number(row.actual_minutes ?? 0),
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

export async function createAssignment(input: {
  title: string;
  subjectId: string | null;
  dueDate: string; // "yyyy-MM-dd" — 클라이언트 로컬 기준 포맷된 문자열
  difficulty: Difficulty;
  estimatedHours: number;
}): Promise<{ data: Assignment | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      user_id: user.id,
      title: input.title,
      subject_id: input.subjectId ?? null,
      due_date: input.dueDate,
      difficulty: input.difficulty,
      estimated_hours: input.estimatedHours,
    })
    .select("*, subjects(name)")
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/today");
  return { data: fromDb(data), error: null };
}

export async function updateAssignment(
  id: string,
  input: {
    title: string;
    subjectId: string | null;
    dueDate: string; // "yyyy-MM-dd" — 클라이언트 로컬 기준 포맷된 문자열
    difficulty: Difficulty;
    estimatedHours: number;
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("assignments")
    .update({
      title: input.title,
      subject_id: input.subjectId ?? null,
      due_date: input.dueDate,
      difficulty: input.difficulty,
      estimated_hours: input.estimatedHours,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/today");
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
  revalidatePath("/calendar");
  revalidatePath("/today");
  return { error: null };
}

export async function logStudyTime(
  id: string,
  minutes: number
): Promise<{ actualMinutes: number | null; error: string | null }> {
  // 서버 검증 — 정수 1~999분
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 999) {
    return { actualMinutes: null, error: "1~999분 사이로 입력해주세요" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { actualMinutes: null, error: "로그인이 필요합니다" };

  // DB에서 원자적으로 증가 후 새 값 반환
  const { data, error } = await supabase.rpc("increment_actual_minutes", {
    p_assignment_id: id,
    p_add_minutes: minutes,
  });

  if (error) return { actualMinutes: null, error: error.message };
  // data가 null이면 과제 미존재 or 범위 위반 (RPC WHERE 조건 불충족)
  if (data === null) return { actualMinutes: null, error: "기록에 실패했습니다. 다시 시도해주세요." };

  revalidatePath("/today");
  revalidatePath("/dashboard");
  return { actualMinutes: data as number, error: null };
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
  revalidatePath("/calendar");
  revalidatePath("/today");
  return { error: null };
}
