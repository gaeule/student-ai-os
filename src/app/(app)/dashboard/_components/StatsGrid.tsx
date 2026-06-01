import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { differenceInDays, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/types";

// ---- 통계 계산 ----
function calcStats(assignments: Assignment[]) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // 월요일 기준
  const weekEnd   = endOfWeek(now,   { weekStartsOn: 1 });

  const thisWeek = assignments.filter(
    (a) => a.dueDate >= weekStart && a.dueDate <= weekEnd
  );
  const urgent = assignments.filter(
    (a) => a.status !== "done" && differenceInDays(a.dueDate, now) <= 3
  );
  const done  = assignments.filter((a) => a.status === "done").length;
  const total = assignments.length;
  const rate  = total === 0 ? 0 : Math.round((done / total) * 100);
  const weekDone = assignments.filter(
    (a) => a.completedAt && a.completedAt >= weekStart && a.completedAt <= weekEnd
  ).length;

  return { thisWeek: thisWeek.length, urgent: urgent.length, rate, done, total, weekDone };
}

// ---- 카드 ----
type StatItem = {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;        // icon 색상
  bg: string;           // icon 배경
  border: string;       // 카드 테두리 강조 (긴급 시)
  accent?: boolean;
};

function StatCard({ item }: { item: StatItem }) {
  const Icon = item.icon;
  return (
    <div
      className={cn(
        "bg-card flex flex-col gap-4 rounded-xl border p-5 shadow-sm",
        item.border
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {item.label}
          </p>
          <p className={cn("mt-1 text-2xl font-bold sm:text-3xl", item.accent && "text-red-600")}>
            {item.value}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", item.bg)}>
          <Icon className={cn("h-5 w-5", item.color)} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{item.sub}</p>
    </div>
  );
}

// ---- 완료율 카드 (프로그레스 바 포함) ----
function RateCard({ rate, done, total }: { rate: number; done: number; total: number }) {
  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            완료율
          </p>
          <p className="mt-1 text-2xl font-bold sm:text-3xl">{rate}%</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
      </div>
      {/* 프로그레스 바 */}
      <div className="space-y-1.5">
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${rate}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          전체 {total}개 중 {done}개 완료
        </p>
      </div>
    </div>
  );
}

// ---- 메인 ----
export function StatsGrid({ assignments }: { assignments: Assignment[] }) {
  const { thisWeek, urgent, rate, done, total, weekDone } = calcStats(assignments);

  const stats: StatItem[] = [
    {
      label: "이번 주 과제",
      value: thisWeek,
      sub: "이번 주 마감 예정",
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-border",
    },
    {
      label: "마감 임박",
      value: urgent,
      sub: "3일 이내 마감 (미완료)",
      icon: AlertTriangle,
      color: urgent > 0 ? "text-red-600" : "text-muted-foreground",
      bg: urgent > 0 ? "bg-red-50" : "bg-muted",
      border: urgent > 0 ? "border-red-200" : "border-border",
      accent: urgent > 0,
    },
    {
      label: "이번 주 완료",
      value: weekDone,
      sub: "이번 주 완료한 과제",
      icon: CheckCircle2,
      color: weekDone > 0 ? "text-green-600" : "text-muted-foreground",
      bg: weekDone > 0 ? "bg-green-50" : "bg-muted",
      border: "border-border",
    },
    {
      label: "진행 중",
      value: total - done,
      sub: `전체 ${total}개 중 미완료`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-border",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {stats.map((s) => (
        <StatCard key={s.label} item={s} />
      ))}
      <RateCard rate={rate} done={done} total={total} />
    </div>
  );
}
