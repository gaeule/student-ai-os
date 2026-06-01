"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Exam, ExamType } from "@/types";

function fromDb(row: Record<string, unknown>): Exam {
  const subjects = row.subjects as { name: string } | null;
  return {
    id: row.id as string,
    subjectId: (row.subject_id as string | null) ?? null,
    subjectName: subjects?.name ?? null,
    examType: row.exam_type as ExamType,
    examDate: new Date(row.exam_date as string),
    scope: (row.scope as string | null) ?? null,
    prepDays: Number(row.prep_days ?? 3),
    createdAt: new Date(row.created_at as string),
  };
}

export async function getExams(): Promise<Exam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select("*, subjects(name)")
    .order("exam_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDb);
}

export async function createExam(
  input: Pick<Exam, "subjectId" | "examType" | "examDate" | "scope" | "prepDays">
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("exams")
    .insert({
      user_id: user.id,
      subject_id: input.subjectId ?? null,
      exam_type: input.examType,
      exam_date: input.examDate.toISOString().split("T")[0],
      scope: input.scope || null,
      prep_days: input.prepDays,
    });

  if (error) return { error: error.message };

  revalidatePath("/exams");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateExam(
  id: string,
  input: Pick<Exam, "subjectId" | "examType" | "examDate" | "scope" | "prepDays">
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("exams")
    .update({
      subject_id: input.subjectId ?? null,
      exam_type: input.examType,
      exam_date: input.examDate.toISOString().split("T")[0],
      scope: input.scope || null,
      prep_days: input.prepDays,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/exams");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteExam(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/exams");
  revalidatePath("/dashboard");
  return { error: null };
}
