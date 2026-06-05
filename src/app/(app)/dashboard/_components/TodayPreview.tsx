import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Sparkles, Clock, BookOpen, CalendarDays, ArrowRight, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildDailyPlan, type StudyBlock } from "@/lib/studyPlan";
import type { Assignment, Difficulty, Exam } from "@/types";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; className: string }> = {
  hard:   { label: "상", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "중", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  easy:   { label: "하", className: "bg-green-100 text-green-700 border-green-200" },
};

const DEFAULT_TOTAL_HOURS = 3; // 미리보기용 기본 입력 시간
const PREVIEW_LIMIT = 3; // 최대 표시 개수

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function PreviewCard({ item, rank }: { item: StudyBlock; rank: number }) {
  if (item.type === "assignment") {
    const diff = DIFFICULTY_CONFIG[item.difficulty];
    const daysLabel =
      item.daysLeft === 0 ? "오늘 마감" :
      item.daysLeft === 1 ? "내일 마감" :
      `${item.daysLeft}일 남음`;
    const isUrgent = item.daysLeft <= 1;

    return (
      <div
        className={cn(
          "bg-card border-border flex flex-col gap-3 rounded-xl border p-4 shadow-sm",
          isUrgent && "border-red-200 bg-red-50/30"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">#{rank}</span>
          <Badge variant="outline" className={cn("text-xs", diff.className)}>
            {diff.label}
          </Badge>
        </div>

        <p className="text-foreground line-clamp-2 text-sm font-semibold leading-snug">
          {item.title}
        </p>

        <div className="mt-auto space-y-1 text-xs text-muted-foreground">
          {item.subjectName && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              {item.subjectName}
            </span>
          )}
          <span className={cn(
            "flex items-center gap-1",
            isUrgent && "text-red-500 font-semibold"
          )}>
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {format(item.dueDate, "M/d (E)", { locale: ko })} · {daysLabel}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            오늘 {formatMinutes(item.allocatedMinutes)} / 총 {formatMinutes(item.requestedMinutes)}
          </span>
        </div>
      </div>
    );
  }

  // 시험 복습 카드
  const daysLabel =
    item.daysLeft === 0 ? "오늘 시험" :
    item.daysLeft === 1 ? "내일 시험" :
    `${item.daysLeft}일 후 시험`;

  return (
    <div className="bg-violet-50 border-violet-200 flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-violet-500 text-xs font-medium">#{rank}</span>
        <Badge variant="outline" className="text-xs bg-violet-100 text-violet-700 border-violet-300">
          복습
        </Badge>
      </div>

      <p className="text-violet-900 line-clamp-2 text-sm font-semibold leading-snug">
        {item.title}
      </p>

      <div className="mt-auto space-y-1 text-xs text-violet-600">
        {item.subjectName && (
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            {item.subjectName}
          </span>
        )}
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {format(item.examDate, "M/d (E)", { locale: ko })} · {daysLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          복습 {formatMinutes(item.allocatedMinutes)}
        </span>
      </div>
    </div>
  );
}

export function TodayPreview({
  assignments,
  exams,
  blockedHours,
}: {
  assignments: Assignment[];
  exams: Exam[];
  blockedHours: number;
}) {
  const availableHours = Math.max(0, DEFAULT_TOTAL_HOURS - blockedHours);
  const preview = buildDailyPlan(assignments, exams, availableHours).scheduled.slice(0, PREVIEW_LIMIT);

  return (
    <section className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold">오늘 학습 계획</h3>
          <span className="text-muted-foreground text-xs">
            (기준: {availableHours}시간 가용{blockedHours > 0 && ` · 고정 일정 ${blockedHours}h 차감`})
          </span>
        </div>
        <Link
          href="/today"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
        >
          시간 설정하기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* 카드 목록 */}
      {preview.length === 0 ? (
        <div className="bg-muted/40 border-border flex items-center justify-center rounded-xl border py-10">
          <p className="text-muted-foreground text-sm">
            추천할 학습 항목이 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {preview.map((item, i) => (
            <PreviewCard key={item.id} item={item} rank={i + 1} />
          ))}
        </div>
      )}

      {/* 하단 링크 */}
      <div className="flex justify-end">
        <Link
          href="/today"
          className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
        >
          전체 계획 보기
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
