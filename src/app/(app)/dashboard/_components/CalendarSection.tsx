"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, differenceInDays,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAssignment } from "@/lib/actions/assignments";
import { createSchedule, deleteSchedule } from "@/lib/actions/schedules";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Assignment, Exam, Schedule, ScheduleCategory } from "@/types";

const EXAM_TYPE_LABEL: Record<string, string> = {
  midterm: "중간고사", final: "기말고사", quiz: "쪽지시험", practical: "실기",
};

const CATEGORIES: ScheduleCategory[] = ["수업", "알바", "동아리", "병원", "약속", "기타"];

const CATEGORY_COLOR: Record<ScheduleCategory, string> = {
  수업: "bg-violet-500",
  알바: "bg-orange-400",
  동아리: "bg-pink-400",
  병원: "bg-cyan-500",
  약속: "bg-amber-400",
  기타: "bg-gray-400",
};

type CalendarEvent =
  | { type: "assignment"; label: string }
  | { type: "assignment-done"; label: string }
  | { type: "exam"; label: string }
  | { type: "exam-prep"; label: string }
  | { type: "schedule"; label: string; id: string; time: string; category: ScheduleCategory };

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type AddMode = "assignment" | "schedule";

export function CalendarSection({
  assignments,
  exams,
  schedules: initialSchedules,
}: {
  assignments: Assignment[];
  exams: Exam[];
  schedules: Schedule[];
}) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("assignment");
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);

  // 과제 빠른 추가
  const [quickTitle, setQuickTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  // 고정 일정 추가 폼
  const [schedTitle, setSchedTitle] = useState("");
  const [schedStart, setSchedStart] = useState("09:00");
  const [schedEnd, setSchedEnd] = useState("10:00");
  const [schedCategory, setSchedCategory] = useState<ScheduleCategory>("수업");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function getEventsForDate(date: Date): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const dateStr = format(date, "yyyy-MM-dd");

    for (const a of assignments) {
      if (format(a.dueDate, "yyyy-MM-dd") === dateStr) {
        events.push({ type: a.status === "done" ? "assignment-done" : "assignment", label: a.title });
      }
    }
    for (const exam of exams) {
      if (format(exam.examDate, "yyyy-MM-dd") === dateStr) {
        events.push({ type: "exam", label: `${exam.subjectName ?? "시험"} ${EXAM_TYPE_LABEL[exam.examType]}` });
      } else {
        const daysToExam = differenceInDays(exam.examDate, date);
        if (daysToExam > 0 && daysToExam <= exam.prepDays) {
          events.push({ type: "exam-prep", label: `${exam.subjectName ?? "시험"} 준비` });
        }
      }
    }
    for (const s of schedules) {
      if (format(s.date, "yyyy-MM-dd") === dateStr) {
        events.push({ type: "schedule", label: s.title, id: s.id, time: `${s.startTime}~${s.endTime}`, category: s.category });
      }
    }

    return events;
  }

  function handleDayClick(day: Date) {
    setSelectedDate(selectedDate && isSameDay(day, selectedDate) ? null : day);
    setQuickTitle("");
    setSchedTitle("");
  }

  function handleQuickAdd() {
    if (!quickTitle.trim() || !selectedDate) return;
    startTransition(async () => {
      await createAssignment({ title: quickTitle.trim(), subjectId: null, dueDate: format(selectedDate, "yyyy-MM-dd"), difficulty: "medium", estimatedHours: 2 });
      setQuickTitle("");
      router.refresh();
    });
  }

  function handleScheduleAdd() {
    if (!schedTitle.trim() || !selectedDate) return;
    startTransition(async () => {
      const { data: newSchedule, error } = await createSchedule({
        title: schedTitle.trim(),
        date: format(selectedDate, "yyyy-MM-dd"),
        startTime: schedStart,
        endTime: schedEnd,
        category: schedCategory,
      });
      if (error || !newSchedule) return;
      setSchedTitle("");
      setSchedules((prev) => [...prev, newSchedule]);
      router.refresh();
    });
  }

  function handleScheduleDelete(id: string) {
    startTransition(async () => {
      await deleteSchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    });
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <section className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">캘린더</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 transition-colors hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-24 text-center text-sm font-medium">
            {format(currentMonth, "yyyy년 M월", { locale: ko })}
          </span>
          <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 transition-colors hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="bg-card overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={cn("py-2 text-center text-xs font-medium text-muted-foreground", i === 0 && "text-red-500", i === 6 && "text-blue-500")}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const events = getEventsForDate(day);
            const hasAssignment = events.some((e) => e.type === "assignment");
            const hasDone = events.some((e) => e.type === "assignment-done");
            const hasExam = events.some((e) => e.type === "exam");
            const hasPrep = events.some((e) => e.type === "exam-prep");
            const hasSchedule = events.some((e) => e.type === "schedule");
            const isSelected = !!selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const dow = day.getDay();

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayClick(day)}
                className={cn(
                  "relative min-h-[52px] border-b border-r border-border/40 p-1.5 text-left transition-colors hover:bg-muted/50",
                  !isCurrentMonth && "opacity-30",
                  hasPrep && !isSelected && "bg-red-50/60",
                  isSelected && "bg-primary/10",
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isTodayDate && "bg-primary text-primary-foreground",
                  !isTodayDate && dow === 0 && "text-red-500",
                  !isTodayDate && dow === 6 && "text-blue-500"
                )}>
                  {format(day, "d")}
                </span>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {hasAssignment && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                  {hasDone && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  {hasExam && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  {hasPrep && !hasExam && <span className="h-1.5 w-1.5 rounded-full bg-red-300" />}
                  {hasSchedule && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {[
          { color: "bg-blue-500", label: "과제 마감" },
          { color: "bg-green-500", label: "완료 과제" },
          { color: "bg-red-500", label: "시험" },
          { color: "bg-red-300", label: "시험 준비" },
          { color: "bg-violet-500", label: "고정 일정" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            {label}
          </span>
        ))}
      </div>

      {/* 날짜 클릭 패널 */}
      {selectedDate && (
        <div className="bg-card space-y-4 rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {format(selectedDate, "M월 d일 (E)", { locale: ko })}
            </h4>
            <button type="button" onClick={() => setSelectedDate(null)} className="rounded-md p-1 transition-colors hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* 일정 목록 */}
          {selectedEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">등록된 일정이 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedEvents.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full",
                      e.type === "assignment" && "bg-blue-500",
                      e.type === "assignment-done" && "bg-green-500",
                      e.type === "exam" && "bg-red-500",
                      e.type === "exam-prep" && "bg-red-300",
                      e.type === "schedule" && CATEGORY_COLOR[e.category],
                    )} />
                    <span className={cn("truncate", e.type === "assignment-done" && "line-through text-muted-foreground")}>
                      {e.type === "schedule" ? `${e.time} ${e.label}` : e.label}
                    </span>
                  </div>
                  {e.type === "schedule" && (
                    <button type="button" onClick={() => handleScheduleDelete(e.id)} disabled={isPending} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* 추가 모드 탭 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setAddMode("assignment")}
              className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                addMode === "assignment" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              과제 추가
            </button>
            <button
              type="button"
              onClick={() => setAddMode("schedule")}
              className={cn("flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                addMode === "schedule" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              고정 일정
            </button>
          </div>

          {/* 과제 빠른 추가 */}
          {addMode === "assignment" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="과제 제목 입력 (Enter)"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={handleQuickAdd} disabled={!quickTitle.trim() || isPending} className="h-8 px-3">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">난이도 중, 2시간으로 등록됩니다. 과제 페이지에서 수정 가능합니다.</p>
            </div>
          )}

          {/* 고정 일정 추가 */}
          {addMode === "schedule" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">제목</Label>
                <Input
                  placeholder="예: 알바, 수업, 동아리"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">시작</Label>
                  <input
                    type="time"
                    value={schedStart}
                    onChange={(e) => setSchedStart(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">종료</Label>
                  <input
                    type="time"
                    value={schedEnd}
                    onChange={(e) => setSchedEnd(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">카테고리</Label>
                <Select value={schedCategory} onValueChange={(v) => setSchedCategory(v as ScheduleCategory)}>
                  <SelectTrigger className="h-8 w-full text-sm">
                    <span>{schedCategory}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleScheduleAdd} disabled={!schedTitle.trim() || isPending} className="w-full h-8">
                고정 일정 등록
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
