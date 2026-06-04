"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Clock,
  BookOpen,
  CalendarDays,
  Sparkles,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Bot,
  Check,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { recommend, type ScoredAssignment, type RecommendResult } from "@/lib/priority";
import { getAIComment } from "@/lib/actions/ai";
import { updateAssignmentStatus } from "@/lib/actions/assignments";
import type { Assignment, Difficulty, Exam, Schedule } from "@/types";

// ---- 상수 ----
const QUICK_HOURS = [1, 1.5, 2, 3, 4, 5];

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; className: string }> = {
  hard:   { label: "상", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "중", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  easy:   { label: "하", className: "bg-green-100 text-green-700 border-green-200" },
};

const RANK_STYLE = [
  "bg-yellow-400 text-yellow-900",
  "bg-slate-300 text-slate-800",
  "bg-amber-600 text-amber-50",
];

// ---- AI 코멘트 박스 ----
function AICommentBox({
  comment,
  loading,
  error,
}: {
  comment: string | null;
  loading: boolean;
  error: string | null;
}) {
  if (!loading && !comment && !error) return null;

  return (
    <div className="bg-primary/5 border-primary/20 rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">AI 학습 코치</span>
        <span className="text-muted-foreground text-xs">llama-3.3-70b</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="bg-primary/10 h-3 w-full animate-pulse rounded" />
          <div className="bg-primary/10 h-3 w-4/5 animate-pulse rounded" />
          <div className="bg-primary/10 h-3 w-3/5 animate-pulse rounded" />
        </div>
      ) : error ? (
        <p className="text-muted-foreground text-sm">{error}</p>
      ) : (
        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {comment}
        </p>
      )}
    </div>
  );
}

// ---- 추천 카드 ----
function RecommendCard({
  item,
  rank,
  completing,
  onComplete,
}: {
  item: ScoredAssignment;
  rank: number;
  completing: boolean;
  onComplete: (id: string) => void;
}) {
  const diff = DIFFICULTY_CONFIG[item.difficulty];
  const isPartial = item.allocatedHours < item.estimatedHours;

  return (
    <div className="bg-card border-border flex gap-4 rounded-xl border p-5 shadow-sm">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          rank <= 3 ? RANK_STYLE[rank - 1] : "bg-muted text-muted-foreground"
        )}
      >
        {rank}
      </div>

      <div className="flex flex-1 flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-sm font-semibold leading-snug">
            {item.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={cn("text-xs", diff.className)}>
              {diff.label}
            </Badge>
            <button
              type="button"
              onClick={() => onComplete(item.id)}
              disabled={completing}
              title="완료 처리"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                completing
                  ? "border-green-300 bg-green-50 text-green-400 cursor-wait"
                  : "border-border text-muted-foreground hover:border-green-400 hover:bg-green-50 hover:text-green-600"
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 추천 이유 요약 */}
        {item.prioritySummary && (
          <p className="text-primary/80 text-xs leading-snug font-medium">
            {item.prioritySummary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {item.subjectName && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {item.subjectName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(item.dueDate, "M월 d일 (E)", { locale: ko })}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              오늘 배정:{" "}
              <span className="text-foreground font-semibold ml-0.5">
                {item.allocatedHours}시간
              </span>
              <span className="text-muted-foreground">/ 총 {item.estimatedHours}시간</span>
            </span>
            {isPartial && (
              <span className="text-yellow-600 text-[11px]">부분 작업</span>
            )}
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isPartial ? "bg-yellow-400" : "bg-primary"
              )}
              style={{ width: `${(item.allocatedHours / item.estimatedHours) * 100}%` }}
            />
          </div>
        </div>

        {item.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.reasons.map((r) => (
              <span
                key={r}
                className="bg-primary/8 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium"
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 결과 요약 ----
function Summary({ result, available }: { result: ScoredAssignment[]; available: number }) {
  const used = result.reduce((s, a) => s + a.allocatedHours, 0);
  const allFit = result.every((a) => a.allocatedHours >= a.estimatedHours);

  return (
    <div className="bg-muted/50 border-border flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
      {allFit ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600" />
      )}
      <span>
        <span className="font-semibold">{available}시간</span> 중{" "}
        <span className="font-semibold">{used}시간</span> 배정 ·{" "}
        <span className="font-semibold">{result.length}개</span> 과제 추천
        {!allFit && (
          <span className="text-muted-foreground ml-1">(일부 과제는 다음에 이어서)</span>
        )}
      </span>
    </div>
  );
}

// ---- 오버플로우 플랜 (오늘 시간 부족) ----
function OverflowPlan({ items }: { items: ScoredAssignment[] }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground">
          오늘 시간 부족 — 내일 이어서 할 과제
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg bg-background border border-border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.prioritySummary}</p>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground space-y-0.5">
              {item.allocatedHours > 0 ? (
                <p>
                  오늘 {item.allocatedHours}h · 내일{" "}
                  <span className="font-medium text-foreground">
                    {item.remainingHours}h
                  </span>{" "}
                  남음
                </p>
              ) : (
                <p>{item.remainingHours}시간 필요</p>
              )}
              <p>{format(item.dueDate, "M/d (E)", { locale: ko })} 마감</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground pl-1">
        내일 다시 추천받으면 위 과제가 우선순위에 반영됩니다.
      </p>
    </div>
  );
}

// ---- 마감 초과 섹션 ----
function OverduePlan({ items }: { items: ScoredAssignment[] }) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-semibold text-orange-700">마감이 지난 과제</span>
      </div>
      <p className="text-xs text-orange-600 pl-1">
        추천 시간 배정에서 제외됩니다. 제출 가능 여부를 교수님께 먼저 확인하세요.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg bg-background border border-orange-200 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
              {item.subjectName && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.subjectName}</p>
              )}
            </div>
            <div className="shrink-0 text-right text-xs space-y-0.5">
              <p className="text-orange-600 font-medium">
                {Math.abs(item.daysLeft)}일 초과
              </p>
              <p className="text-muted-foreground">
                {format(item.dueDate, "M/d (E)", { locale: ko })} 마감
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- blocked hours 계산 (겹침 병합 포함) ----
function calcBlockedHours(schedules: Schedule[]): number {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const intervals = schedules
    .filter((s) => {
      const d = s.date instanceof Date ? s.date : new Date(s.date);
      return format(d, "yyyy-MM-dd") === todayStr;
    })
    .map((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return [sh * 60 + sm, eh * 60 + em] as [number, number];
    })
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  // 겹치는 구간 병합
  let totalMinutes = 0;
  let mergedStart = -1;
  let mergedEnd = -1;

  for (const [start, end] of intervals) {
    if (mergedEnd < 0 || start > mergedEnd) {
      if (mergedEnd >= 0) totalMinutes += mergedEnd - mergedStart;
      mergedStart = start;
      mergedEnd = end;
    } else {
      mergedEnd = Math.max(mergedEnd, end);
    }
  }
  if (mergedEnd >= 0) totalMinutes += mergedEnd - mergedStart;

  return Math.round((totalMinutes / 60) * 10) / 10;
}

// ---- 메인 컴포넌트 ----
export function TodayPlanner({
  assignments,
  exams,
  schedules,
}: {
  assignments: Assignment[];
  exams: Exam[];
  schedules: Schedule[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [hours, setHours] = useState<number | "">(2);
  const blockedHours = calcBlockedHours(schedules);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  // AI 요청 race condition 방지: 최신 요청 ID만 결과 반영
  const aiRequestId = useRef(0);

  const todo = assignments.filter((a) => a.status !== "done");

  const availableHours = Math.max(0, Number(hours || 0) - blockedHours);

  function handleComplete(id: string) {
    setCompletingId(id);
    // 진행 중인 AI 요청 무효화 + 로딩 즉시 해제
    aiRequestId.current++;
    setAiLoading(false);
    startTransition(async () => {
      const { error } = await updateAssignmentStatus(id, "done");
      if (!error) {
        // 완료된 과제 즉시 제외하고 재계산 (props 기반 — router.refresh() 전까지 서버와 잠깐 차이 날 수 있으나 허용 범위)
        const remaining = assignments.filter((a) => a.id !== id && a.status !== "done");
        setResult(recommend(remaining, exams, availableHours));
        setAiComment(null);
        setAiError(null);
        router.refresh();
      }
      setCompletingId(null);
    });
  }

  const handleRecommend = async () => {
    if (!hours || Number(hours) <= 0) return;

    // 1. 로컬 알고리즘 즉시 실행 (고정 일정 차감 후 가용 시간 기준)
    const recommendations = recommend(assignments, exams, availableHours);
    setResult(recommendations);

    // 2. AI 코멘트 비동기 요청 — 요청 ID 채번
    const reqId = ++aiRequestId.current;
    setAiComment(null);
    setAiError(null);
    setAiLoading(true);

    try {
      const { comment, error } = await getAIComment(recommendations.scheduled, availableHours);
      // 완료 처리 등으로 더 최신 요청이 생겼으면 이 응답은 버림
      if (aiRequestId.current === reqId) {
        setAiComment(comment);
        setAiError(error);
      }
    } catch {
      if (aiRequestId.current === reqId) {
        setAiError("AI 코멘트를 불러오지 못했습니다.");
      }
    } finally {
      if (aiRequestId.current === reqId) {
        setAiLoading(false);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* 오늘 고정 일정 — 자동 차감 배너 */}
      {blockedHours > 0 && (
        <div className="bg-violet-50 border-violet-200 rounded-xl border px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-violet-500" />
            <span className="text-violet-700 font-medium">오늘 고정 일정 {blockedHours}시간 자동 차감</span>
          </div>
          {hours !== "" && Number(hours) > 0 && (
            <p className="text-violet-600 text-xs mt-1 ml-6">
              입력 {hours}h - 고정 {blockedHours}h ={" "}
              <span className="font-semibold">공부 가능 {availableHours}시간</span>으로 추천합니다
            </p>
          )}
        </div>
      )}

      {/* 입력 섹션 */}
      <div className="bg-card border-border rounded-xl border p-6 shadow-sm">
        <p className="text-foreground mb-4 font-medium">
          오늘 공부에 쓸 수 있는 시간이 얼마나 되나요?
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                hours === h
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-muted text-foreground"
              )}
            >
              {h}시간
            </button>
          ))}
        </div>

        <div className="mb-5 flex items-center gap-2">
          <span className="text-muted-foreground text-sm">직접 입력</span>
          <div className="relative flex items-center">
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={hours}
              onChange={(e) =>
                setHours(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="border-input bg-background focus:ring-ring h-9 w-24 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2"
              placeholder="0"
            />
            <span className="text-muted-foreground absolute right-3 text-sm">시간</span>
          </div>
        </div>

        {hours !== "" && Number(hours) > 0 && availableHours === 0 && (
          <p className="mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
            고정 일정으로 인해 공부 가능 시간이 0시간입니다. 더 긴 시간을 입력하거나 고정 일정을 확인하세요.
          </p>
        )}
        <Button
          onClick={handleRecommend}
          disabled={!hours || Number(hours) <= 0 || availableHours === 0 || todo.length === 0 || aiLoading}
          className="w-full gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {todo.length === 0
            ? "등록된 과제 없음"
            : aiLoading
            ? "AI 분석 중..."
            : "오늘 할 일 추천받기"}
        </Button>
      </div>

      {/* 추천 결과 */}
      {result !== null && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-500 h-5 w-5" />
            <h3 className="font-semibold">오늘의 추천 과제</h3>
          </div>

          {result.scheduled.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              추천할 과제가 없습니다.
            </div>
          ) : (
            <>
              <Summary result={result.scheduled} available={availableHours} />

              {/* AI 코멘트 */}
              <AICommentBox
                comment={aiComment}
                loading={aiLoading}
                error={aiError}
              />

              <div className="space-y-3">
                {result.scheduled.map((item, i) => (
                  <RecommendCard
                    key={item.id}
                    item={item}
                    rank={i + 1}
                    completing={completingId === item.id}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </>
          )}

          {/* 오늘 시간 부족 과제 */}
          {result.overflow.length > 0 && (
            <OverflowPlan items={result.overflow} />
          )}

          {/* 마감 초과 — 별도 확인 필요 */}
          {result.overdue.length > 0 && (
            <OverduePlan items={result.overdue} />
          )}
        </div>
      )}
    </div>
  );
}
