import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Sparkles, Clock, BookOpen, CalendarDays, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { recommend } from "@/lib/priority";
import type { Assignment, Difficulty, Exam } from "@/types";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; className: string }> = {
  hard:   { label: "상", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "중", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  easy:   { label: "하", className: "bg-green-100 text-green-700 border-green-200" },
};

const DEFAULT_HOURS = 3; // 미리보기용 기본 가용 시간
const PREVIEW_LIMIT = 3; // 최대 표시 개수

export function TodayPreview({ assignments, exams }: { assignments: Assignment[]; exams: Exam[] }) {
  const recommended = recommend(assignments, exams, DEFAULT_HOURS).slice(0, PREVIEW_LIMIT);

  return (
    <section className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold">오늘 추천 과제</h3>
          <span className="text-muted-foreground text-xs">
            (기준: {DEFAULT_HOURS}시간 가용)
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
      {recommended.length === 0 ? (
        <div className="bg-muted/40 border-border flex items-center justify-center rounded-xl border py-10">
          <p className="text-muted-foreground text-sm">
            추천할 과제가 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {recommended.map((item, i) => {
            const diff = DIFFICULTY_CONFIG[item.difficulty];
            const daysLabel =
              item.daysLeft <= 0  ? "마감 초과" :
              item.daysLeft === 1 ? "오늘 마감" :
              `${item.daysLeft}일 남음`;
            const isUrgent = item.daysLeft <= 2;

            return (
              <div
                key={item.id}
                className={cn(
                  "bg-card border-border flex flex-col gap-3 rounded-xl border p-4 shadow-sm",
                  isUrgent && "border-red-200 bg-red-50/30"
                )}
              >
                {/* 순위 + 난이도 */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    #{i + 1}
                  </span>
                  <Badge variant="outline" className={cn("text-xs", diff.className)}>
                    {diff.label}
                  </Badge>
                </div>

                {/* 제목 */}
                <p className="text-foreground line-clamp-2 text-sm font-semibold leading-snug">
                  {item.title}
                </p>

                {/* 메타 */}
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
                    오늘 {item.allocatedHours}h / 총 {item.estimatedHours}h
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 링크 */}
      <div className="flex justify-end">
        <Link
          href="/today"
          className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
        >
          전체 추천 보기
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
