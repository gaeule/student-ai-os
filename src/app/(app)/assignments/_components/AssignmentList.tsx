"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { differenceInDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Clock, BookOpen, CalendarDays, AlertCircle,
  CheckCircle2, CircleDot, Trash2, Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updateAssignmentStatus, deleteAssignment } from "@/lib/actions/assignments";
import type { Assignment, Difficulty, AssignmentStatus } from "@/types";

// ---- 상수 ----
const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; className: string }> = {
  hard:   { label: "상", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "중", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  easy:   { label: "하", className: "bg-green-100 text-green-700 border-green-200" },
};

// 상태 순환: todo → in_progress → done → todo
const STATUS_CYCLE: Record<AssignmentStatus, AssignmentStatus> = {
  todo:        "in_progress",
  in_progress: "done",
  done:        "todo",
};

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  todo:        { label: "시작 전", icon: CircleDot,    className: "text-muted-foreground" },
  in_progress: { label: "진행 중", icon: AlertCircle,  className: "text-blue-600" },
  done:        { label: "완료",    icon: CheckCircle2, className: "text-green-600" },
};

function getDueDateStyle(dueDate: Date): { label: string; className: string } {
  const days = differenceInDays(dueDate, new Date());
  if (days < 0)   return { label: "마감 초과", className: "text-red-600 font-bold" };
  if (days === 0) return { label: "오늘 마감", className: "text-red-600 font-bold" };
  if (days <= 2)  return { label: `${days}일 남음`, className: "text-red-500 font-semibold" };
  if (days <= 7)  return { label: `${days}일 남음`, className: "text-yellow-600 font-medium" };
  return { label: `${days}일 남음`, className: "text-muted-foreground" };
}

// ---- 카드 ----
function AssignmentCard({ assignment, onEdit }: { assignment: Assignment; onEdit: (a: Assignment) => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const diff = DIFFICULTY_CONFIG[assignment.difficulty];
  const statusCfg = STATUS_CONFIG[assignment.status];
  const StatusIcon = statusCfg.icon;
  const due = getDueDateStyle(assignment.dueDate);
  const isUrgent = differenceInDays(assignment.dueDate, new Date()) <= 2;

  function handleStatusClick() {
    startTransition(async () => {
      await updateAssignmentStatus(assignment.id, STATUS_CYCLE[assignment.status]);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`"${assignment.title}" 과제를 삭제할까요?`)) return;
    startTransition(async () => {
      await deleteAssignment(assignment.id);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "bg-card border-border flex flex-col gap-4 rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md",
        isUrgent && assignment.status !== "done" && "border-red-200 bg-red-50/30",
        assignment.status === "done" && "opacity-60",
        isPending && "pointer-events-none animate-pulse"
      )}
    >
      {/* 상단: 제목 + 난이도 */}
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn(
          "text-foreground text-sm font-semibold leading-snug",
          assignment.status === "done" && "line-through"
        )}>
          {assignment.title}
        </h3>
        <Badge variant="outline" className={cn("text-xs shrink-0", diff.className)}>
          {diff.label}
        </Badge>
      </div>

      {/* 메타 정보 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {assignment.subjectName && (
          <span className="text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {assignment.subjectName}
          </span>
        )}
        <span className={cn("flex items-center gap-1", due.className)}>
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {format(assignment.dueDate, "M월 d일 (E)", { locale: ko })}
          <span className="ml-0.5">· {due.label}</span>
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {assignment.estimatedHours}시간
        </span>
      </div>

      {/* 하단: 상태 버튼 + 삭제 */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        {/* 상태 토글 버튼 */}
        <button
          type="button"
          onClick={handleStatusClick}
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-muted",
            statusCfg.className
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusCfg.label}
          <span className="text-muted-foreground font-normal">
            → {STATUS_CONFIG[STATUS_CYCLE[assignment.status]].label}
          </span>
        </button>

        <div className="flex items-center gap-1">
          {/* 수정 버튼 */}
          <button
            type="button"
            onClick={() => onEdit(assignment)}
            disabled={isPending}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {/* 삭제 버튼 */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
            aria-label="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 빈 상태 ----
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <BookOpen className="text-muted-foreground h-6 w-6" />
      </div>
      <p className="text-foreground font-medium">등록된 과제가 없습니다</p>
      <p className="text-muted-foreground mt-1 text-sm">
        새 과제 등록 탭에서 과제를 추가해보세요.
      </p>
    </div>
  );
}

// ---- 메인 ----
export function AssignmentList({ assignments, onEdit }: { assignments: Assignment[]; onEdit: (a: Assignment) => void }) {
  const sorted = useMemo(
    () => [...assignments].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    [assignments]
  );

  const urgent = sorted.filter(
    (a) => a.status !== "done" && differenceInDays(a.dueDate, new Date()) <= 2
  );
  const rest = sorted.filter(
    (a) => !(a.status !== "done" && differenceInDays(a.dueDate, new Date()) <= 2)
  );

  if (sorted.length === 0) return <EmptyState />;

  return (
    <div className="space-y-6">
      {urgent.length > 0 && (
        <section>
          <h3 className="text-destructive mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <AlertCircle className="h-3.5 w-3.5" />
            마감 임박 ({urgent.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {urgent.map((a) => <AssignmentCard key={a.id} assignment={a} onEdit={onEdit} />)}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
            전체 과제 ({rest.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {rest.map((a) => <AssignmentCard key={a.id} assignment={a} onEdit={onEdit} />)}
          </div>
        </section>
      )}
    </div>
  );
}
