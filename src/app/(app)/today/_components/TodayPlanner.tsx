"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays } from "date-fns";
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
  GraduationCap,
  Timer,
  CalendarCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildDailyPlan, type AssignmentStudyBlock, type ExamStudyBlock, type StudyBlock, type DailyPlanResult, type OverdueAssignment, type FuturePlanItem, type UnplacedWarning } from "@/lib/studyPlan";
import { calcBlockedHours } from "@/lib/scheduleUtils";
import { getAIComment } from "@/lib/actions/ai";
import { updateAssignmentStatus, logStudyTime } from "@/lib/actions/assignments";
import type { Assignment, Difficulty, Exam, Schedule } from "@/types";

// ---- 상수 ----
const QUICK_HOURS = [1, 1.5, 2, 3, 4, 5];

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

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

const LOG_QUICK_MINUTES = [15, 30, 45, 60];

// ---- 추천 카드 (과제) ----
function RecommendCard({
  item,
  rank,
  completing,
  logging,
  onComplete,
  onLogTime,
}: {
  item: AssignmentStudyBlock;
  rank: number;
  completing: boolean;
  logging: boolean;
  onComplete: (id: string) => void;
  onLogTime: (id: string, minutes: number) => void;
}) {
  const diff = DIFFICULTY_CONFIG[item.difficulty];
  const isPartial = item.allocatedMinutes < item.requestedMinutes;
  const totalMinutes = Math.round(item.estimatedHours * 60);
  const donePercent = Math.min(100, Math.round((item.actualMinutes / totalMinutes) * 100));

  const [showLogger, setShowLogger] = useState(false);
  const [inputMinutes, setInputMinutes] = useState("");

  function submitLog(minutes: number) {
    if (minutes <= 0) return;
    onLogTime(item.assignmentId, minutes);
    setShowLogger(false);
    setInputMinutes("");
  }

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
            {/* 시간 기록 버튼 */}
            <button
              type="button"
              onClick={() => setShowLogger((v) => !v)}
              disabled={logging}
              title="공부 시간 기록"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                showLogger
                  ? "border-blue-400 bg-blue-50 text-blue-600"
                  : "border-border text-muted-foreground hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
              )}
            >
              <Timer className="h-3.5 w-3.5" />
            </button>
            {/* 완료 버튼 */}
            <button
              type="button"
              onClick={() => onComplete(item.assignmentId)}
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

        {/* 진행률 바 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              오늘 배정:{" "}
              <span className="text-foreground font-semibold ml-0.5">
                {formatMinutes(item.allocatedMinutes)}
              </span>
              <span className="text-muted-foreground">/ 남은 {formatMinutes(item.requestedMinutes)}</span>
            </span>
            {isPartial && (
              <span className="text-yellow-600 text-[11px]">부분 작업</span>
            )}
          </div>
          {/* 전체 진행률 (actualMinutes / totalMinutes) */}
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${donePercent}%` }}
            />
          </div>
          {item.actualMinutes > 0 && (
            <p className="text-[11px] text-muted-foreground">
              누적 {formatMinutes(item.actualMinutes)} 수행 / 총 {formatMinutes(totalMinutes)} ({donePercent}%)
            </p>
          )}
        </div>

        {/* 인라인 시간 기록 패널 */}
        {showLogger && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
            <p className="text-xs font-medium text-blue-800">공부한 시간 기록</p>
            <div className="flex flex-wrap gap-1.5">
              {LOG_QUICK_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => submitLog(m)}
                  disabled={logging}
                  className="rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-xs text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {m}분
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={999}
                placeholder="직접 입력 (분)"
                value={inputMinutes}
                onChange={(e) => setInputMinutes(e.target.value)}
                className="h-7 w-28 rounded-md border border-blue-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={() => submitLog(Number(inputMinutes))}
                disabled={logging || !inputMinutes || Number(inputMinutes) <= 0}
                className="h-7 rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {logging ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={() => { setShowLogger(false); setInputMinutes(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                취소
              </button>
            </div>
          </div>
        )}

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

// ---- 시험 복습 카드 ----
function ExamStudyCard({ item, rank }: { item: ExamStudyBlock; rank: number }) {
  const daysLabel =
    item.daysLeft === 0 ? "오늘 시험" :
    item.daysLeft === 1 ? "내일 시험" :
    `${item.daysLeft}일 후 시험`;

  return (
    <div className="bg-violet-50 border-violet-200 flex gap-4 rounded-xl border p-5 shadow-sm">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          rank <= 3 ? RANK_STYLE[rank - 1] : "bg-violet-200 text-violet-800"
        )}
      >
        {rank}
      </div>

      <div className="flex flex-1 flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-violet-900 text-sm font-semibold leading-snug">
            {item.title}
          </p>
          <Badge variant="outline" className="text-xs bg-violet-100 text-violet-700 border-violet-300 shrink-0">
            복습
          </Badge>
        </div>

        {item.prioritySummary && (
          <p className="text-violet-700 text-xs leading-snug font-medium">
            {item.prioritySummary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-violet-600">
          {item.subjectName && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5" />
              {item.subjectName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(item.examDate, "M월 d일 (E)", { locale: ko })} · {daysLabel}
          </span>
          {item.scope && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {item.scope}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-violet-700">
          <Clock className="h-3.5 w-3.5" />
          복습 배정:{" "}
          <span className="font-semibold ml-0.5">{formatMinutes(item.allocatedMinutes)}</span>
          {item.allocatedMinutes < item.requestedMinutes && (
            <span className="text-violet-500 ml-1">
              (권장 {formatMinutes(item.requestedMinutes)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 결과 요약 ----
function Summary({ result, available }: { result: StudyBlock[]; available: number }) {
  const usedMinutes = result.reduce((s, b) => s + b.allocatedMinutes, 0);
  const allFit = result.every((b) => b.allocatedMinutes >= b.requestedMinutes);
  const assignCount = result.filter((b) => b.type === "assignment").length;
  const examCount = result.filter((b) => b.type === "exam").length;

  return (
    <div className="bg-muted/50 border-border flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
      {allFit ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600" />
      )}
      <span>
        <span className="font-semibold">{available}시간</span> 중{" "}
        <span className="font-semibold">{formatMinutes(usedMinutes)}</span> 배정 ·{" "}
        {assignCount > 0 && <><span className="font-semibold">{assignCount}개</span> 과제</>}
        {assignCount > 0 && examCount > 0 && " + "}
        {examCount > 0 && <><span className="font-semibold">{examCount}개</span> 시험 복습</>}
        {!allFit && (
          <span className="text-muted-foreground ml-1">(일부는 다음에 이어서)</span>
        )}
      </span>
    </div>
  );
}

// ---- 오버플로우 플랜 (오늘 시간 부족) ----
function OverflowPlan({ items }: { items: StudyBlock[] }) {
  const todayExamItems = items.filter((b) => b.type === "exam" && b.daysLeft === 0);
  const restItems = items.filter((b) => !(b.type === "exam" && b.daysLeft === 0));

  return (
    <div className="space-y-3">
      {/* 오늘 시험 — 시간 미배정 경고 */}
      {todayExamItems.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-800">
              오늘 시험 — 복습 시간이 부족합니다
            </span>
          </div>
          <p className="text-xs text-yellow-700 pl-1">
            가용 시간을 늘리거나, 다른 항목을 줄여 복습 시간을 확보하세요.
          </p>
          <div className="space-y-2">
            {todayExamItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-background border border-yellow-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.prioritySummary}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-yellow-700 space-y-0.5">
                  {item.allocatedMinutes > 0 ? (
                    <p>
                      오늘 {formatMinutes(item.allocatedMinutes)} 배정 ·{" "}
                      <span className="font-semibold">{formatMinutes(item.remainingMinutes)} 부족</span>
                    </p>
                  ) : (
                    <p className="font-semibold">권장 {formatMinutes(item.requestedMinutes)} 미배정</p>
                  )}
                  {item.type === "exam" && (
                    <p>{format(item.examDate, "M/d (E)", { locale: ko })} 시험</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 오늘 시간 부족 항목 */}
      {restItems.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">
              오늘 시간 부족
            </span>
          </div>
          <div className="space-y-2">
            {restItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-background border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.prioritySummary}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground space-y-0.5">
                  {item.allocatedMinutes > 0 ? (
                    <p>
                      오늘 {formatMinutes(item.allocatedMinutes)} ·{" "}
                      <span className="font-medium text-foreground">
                        {formatMinutes(item.remainingMinutes)}
                      </span>{" "}
                      남음
                    </p>
                  ) : (
                    <p>{formatMinutes(item.requestedMinutes)} 남음</p>
                  )}
                  {item.type === "assignment" ? (
                    <p>{format(item.dueDate, "M/d (E)", { locale: ko })} 마감</p>
                  ) : (
                    <p>{format(item.examDate, "M/d (E)", { locale: ko })} 시험</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 마감 초과 섹션 ----
function OverduePlan({ items }: { items: OverdueAssignment[] }) {
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

// ---- 못 끝낸 과제 자동 재배치 ----
function FuturePlan({
  futurePlan,
  unplacedWarnings,
}: {
  futurePlan: FuturePlanItem[];
  unplacedWarnings: UnplacedWarning[];
}) {
  if (futurePlan.length === 0 && unplacedWarnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarCheck2 className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">앞으로의 학습 일정</span>
        <span className="text-xs text-blue-500">오늘 못 끝낸 과제 자동 배치</span>
      </div>

      {/* 날짜별 배치 */}
      {futurePlan.length > 0 && (
        <div className="space-y-3">
          {futurePlan.map((day) => (
            <div key={day.dateStr} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700">
                  {format(day.date, "M월 d일 (E)", { locale: ko })}
                </span>
                <span className="text-[11px] text-blue-500">
                  · 총 {formatMinutes(day.totalMinutes)}
                </span>
              </div>
              <div className="space-y-1">
                {day.blocks.map((block) => (
                  <div
                    key={block.assignmentId}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white border border-blue-100 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{block.title}</p>
                      {block.subjectName && (
                        <p className="text-[11px] text-muted-foreground">{block.subjectName}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="text-xs font-semibold text-blue-700">
                        {formatMinutes(block.allocatedMinutes)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(block.dueDate, "M/d (E)", { locale: ko })} 마감
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 배치 못한 시간 경고 */}
      {unplacedWarnings.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">마감 전 배치 불가 — 일정 조정 필요</span>
          </div>
          <div className="space-y-1">
            {unplacedWarnings.map((w) => (
              <div
                key={w.assignmentId}
                className="flex items-center justify-between gap-3 rounded-md bg-white border border-orange-200 px-3 py-2"
              >
                <p className="text-sm font-medium text-foreground truncate">{w.title}</p>
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="text-xs font-semibold text-orange-600">
                    {formatMinutes(w.unplacedMinutes)} 배치 불가
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(w.dueDate, "M/d (E)", { locale: ko })} 마감
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-orange-600 pl-0.5">
            가용 시간을 늘리거나 마감 기한을 교수님께 확인하세요.
          </p>
        </div>
      )}
    </div>
  );
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
  const [result, setResult] = useState<DailyPlanResult | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  // 로컬 assignments 상태 — logStudyTime 후 즉시 재계산을 위해 유지
  const [localAssignments, setLocalAssignments] = useState(assignments);
  // 오늘 수행한 시간 (분) — 가용 시간에서 차감
  // MVP 한계: React 상태에만 존재하므로 새로고침 시 0으로 초기화됨.
  // 새로고침 후에도 정확하려면 날짜별 수행 기록(study_sessions 테이블)이 필요.
  const [loggedMinutesToday, setLoggedMinutesToday] = useState(0);
  // AI 요청 race condition 방지: 최신 요청 ID만 결과 반영
  const aiRequestId = useRef(0);

  const todo = localAssignments.filter((a) => a.status !== "done");

  // 가용 시간 = 입력값 - 고정 일정 - 오늘 이미 수행한 시간
  const availableHours = Math.max(0, Number(hours || 0) - blockedHours - loggedMinutesToday / 60);

  // 실제 복습 블록을 생성할 수 있는 시험이 존재하는지 확인 (KST 기준)
  const kstTodayStr = new Intl.DateTimeFormat("sv", { timeZone: "Asia/Seoul" }).format(new Date());
  const [kty, ktm, ktd] = kstTodayStr.split("-").map(Number);
  const todayMidnight = new Date(kty, ktm - 1, ktd);
  const hasSchedulableExam = exams.some((e) => {
    const d = differenceInDays(e.examDate, todayMidnight);
    return d >= 0 && d <= e.prepDays;
  });

  const hasTodo = todo.length > 0 || hasSchedulableExam;

  function handleComplete(id: string) {
    setCompletingId(id);
    aiRequestId.current++;
    setAiLoading(false);
    startTransition(async () => {
      const { error } = await updateAssignmentStatus(id, "done");
      if (!error) {
        const updated = localAssignments.map((a) =>
          a.id === id ? { ...a, status: "done" as const } : a
        );
        setLocalAssignments(updated);
        const currentAvailableHours = Math.max(0, Number(hours || 0) - blockedHours - loggedMinutesToday / 60);
        setResult(buildDailyPlan(updated.filter((a) => a.status !== "done"), exams, currentAvailableHours));
        setAiComment(null);
        setAiError(null);
        router.refresh();
      }
      setCompletingId(null);
    });
  }

  function handleLogTime(id: string, minutes: number) {
    setLoggingId(id);
    setLogError(null);
    // 진행 중인 AI 응답 무효화
    aiRequestId.current++;
    setAiLoading(false);
    setAiComment(null);
    setAiError(null);
    startTransition(async () => {
      const { actualMinutes: newActualMinutes, error } = await logStudyTime(id, minutes);
      if (!error && newActualMinutes !== null) {
        // 수행 시간만큼 오늘 가용 시간 차감 (클로저 문제 방지: 지역 변수로 계산)
        const newLogged = loggedMinutesToday + minutes;
        setLoggedMinutesToday(newLogged);
        const updatedAvailableHours = Math.max(0, Number(hours || 0) - blockedHours - newLogged / 60);
        // DB 반환값으로 상태 갱신 (추정값 사용 안 함)
        const updated = localAssignments.map((a) =>
          a.id === id ? { ...a, actualMinutes: newActualMinutes } : a
        );
        setLocalAssignments(updated);
        setResult(buildDailyPlan(updated.filter((a) => a.status !== "done"), exams, updatedAvailableHours));
        router.refresh();
      } else if (error) {
        setLogError(error);
      }
      setLoggingId(null);
    });
  }

  const handleRecommend = async () => {
    if (!hours || Number(hours) <= 0) return;

    // 1. 로컬 알고리즘 즉시 실행 — 이미 수행한 시간 차감 유지
    const recommendations = buildDailyPlan(localAssignments.filter((a) => a.status !== "done"), exams, availableHours);
    setResult(recommendations);

    // 2. AI 코멘트 비동기 요청 — 요청 ID 채번
    const reqId = ++aiRequestId.current;
    setAiComment(null);
    setAiError(null);
    setAiLoading(true);

    try {
      const { comment, error } = await getAIComment(recommendations.scheduled, availableHours); // availableHours = 계획 계산과 동일한 값
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
          disabled={!hours || Number(hours) <= 0 || availableHours === 0 || !hasTodo || aiLoading}
          className="w-full gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {!hasTodo
            ? "등록된 과제·시험 없음"
            : aiLoading
            ? "AI 분석 중..."
            : "오늘 할 일 추천받기"}
        </Button>
      </div>

      {/* 시간 기록 오류 */}
      {logError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{logError}</span>
          <button
            type="button"
            onClick={() => setLogError(null)}
            className="ml-auto text-red-400 hover:text-red-600 text-xs"
          >
            닫기
          </button>
        </div>
      )}

      {/* 추천 결과 */}
      {result !== null && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-500 h-5 w-5" />
            <h3 className="font-semibold">오늘의 학습 계획</h3>
          </div>

          {result.scheduled.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              추천할 학습 항목이 없습니다.
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
                {result.scheduled.map((item, i) =>
                  item.type === "assignment" ? (
                    <RecommendCard
                      key={item.id}
                      item={item}
                      rank={i + 1}
                      completing={completingId === item.assignmentId}
                      logging={loggingId === item.assignmentId}
                      onComplete={handleComplete}
                      onLogTime={handleLogTime}
                    />
                  ) : (
                    <ExamStudyCard
                      key={item.id}
                      item={item}
                      rank={i + 1}
                    />
                  )
                )}
              </div>
            </>
          )}

          {/* 오늘 시간 부족 과제 */}
          {result.overflow.length > 0 && (
            <OverflowPlan items={result.overflow} />
          )}

          {/* 못 끝낸 과제 자동 재배치 */}
          {(result.futurePlan.length > 0 || result.unplacedWarnings.length > 0) && (
            <FuturePlan
              futurePlan={result.futurePlan}
              unplacedWarnings={result.unplacedWarnings}
            />
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
