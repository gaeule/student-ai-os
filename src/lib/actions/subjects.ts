"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Subject } from "@/types";

function fromDb(row: Record<string, unknown>): Subject {
  return {
    id: row.id as string,
    name: row.name as string,
    professor: (row.professor as string | null) ?? null,
    semester: (row.semester as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function getSubjects(): Promise<Subject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDb);
}

export async function createSubject(
  input: Pick<Subject, "name" | "professor" | "semester">
): Promise<{ data: Subject | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      user_id: user.id,
      name: input.name,
      professor: input.professor || null,
      semester: input.semester || null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/subjects");
  revalidatePath("/assignments");
  return { data: fromDb(data), error: null };
}

export async function updateSubject(
  id: string,
  input: Pick<Subject, "name" | "professor" | "semester">
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .update({
      name: input.name,
      professor: input.professor || null,
      semester: input.semester || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/subjects");
  revalidatePath("/assignments");
  return { error: null };
}

export async function deleteSubject(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/subjects");
  revalidatePath("/assignments");
  return { error: null };
}
