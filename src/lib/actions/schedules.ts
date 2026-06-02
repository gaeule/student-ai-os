"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Schedule, ScheduleCategory } from "@/types";

function fromDb(row: Record<string, unknown>): Schedule {
  return {
    id: row.id as string,
    title: row.title as string,
    date: new Date(row.date as string),
    startTime: (row.start_time as string).slice(0, 5),
    endTime: (row.end_time as string).slice(0, 5),
    category: row.category as ScheduleCategory,
    memo: (row.memo as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function getSchedules(): Promise<Schedule[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDb);
}

export async function createSchedule(input: {
  title: string;
  date: string; // "yyyy-MM-dd" — 클라이언트 로컬 기준 포맷된 문자열
  startTime: string;
  endTime: string;
  category: ScheduleCategory;
  memo?: string | null;
}): Promise<{ data: Schedule | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      user_id: user.id,
      title: input.title,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      category: input.category,
      memo: input.memo ?? null,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  return { data: fromDb(data as Record<string, unknown>), error: null };
}

export async function deleteSchedule(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  return { error: null };
}
