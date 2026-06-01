"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { recommend, type ScoredAssignment } from "@/lib/priority";
import { getAIComment } from "@/lib/actions/ai";
import type { Assignment, Difficulty, Exam } from "@/types";

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
function RecommendCard({ item, rank }: { item: ScoredAssignment; rank: number }) {
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
          <Badge variant="outline" className={cn("shrink-0 text-xs", diff.className)}>
            {diff.label}
          </Badge>
        </div>

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

// ---- 메인 컴포넌트 ----
export function TodayPlanner({ assignments, exams }: { assignments: Assignment[]; exams: Exam[] }) {
  const [hours, setHours] = useState<number | "">(2);
  const [result, setResult] = useState<ScoredAssignment[] | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const todo = assignments.filter((a) => a.status !== "done");

  const handleRecommend = async () => {
    if (!hours || Number(hours) <= 0) return;

    // 1. 로컬 알고리즘 즉시 실행
    const recommendations = recommend(assignments, exams, Number(hours));
    setResult(recommendations);

    // 2. AI 코멘트 비동기 요청
    setAiComment(null);
    setAiError(null);
    setAiLoading(true);

    try {
      const { comment, error } = await getAIComment(recommendations, Number(hours));
      setAiComment(comment);
      setAiError(error);
    } catch {
      setAiError("AI 코멘트를 불러오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-8">
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

        <Button
          onClick={handleRecommend}
          disabled={!hours || Number(hours) <= 0 || todo.length === 0 || aiLoading}
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

          {result.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              추천할 과제가 없습니다.
            </div>
          ) : (
            <>
              <Summary result={result} available={Number(hours)} />

              {/* AI 코멘트 */}
              <AICommentBox
                comment={aiComment}
                loading={aiLoading}
                error={aiError}
              />

              <div className="space-y-3">
                {result.map((item, i) => (
                  <RecommendCard key={item.id} item={item} rank={i + 1} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
