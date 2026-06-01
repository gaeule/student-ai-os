import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getAssignments } from "@/lib/actions/assignments";
import { getExams } from "@/lib/actions/exams";
import { StatsGrid } from "./_components/StatsGrid";
import { TodayPreview } from "./_components/TodayPreview";
import { Separator } from "@/components/ui/separator";

export default async function DashboardPage() {
  const [assignments, exams] = await Promise.all([getAssignments(), getExams()]);

  const now = new Date();
  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "오후도 화이팅이에요";
    return "오늘 하루도 수고했어요";
  })();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* 인사 */}
      <div>
        <p className="text-muted-foreground text-sm">
          {format(now, "yyyy년 M월 d일 (E)", { locale: ko })}
        </p>
        <h2 className="mt-0.5 text-2xl font-bold">{greeting} 👋</h2>
      </div>

      {/* 통계 카드 */}
      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          이번 주 현황
        </h3>
        <StatsGrid assignments={assignments} />
      </section>

      <Separator />

      {/* 오늘 추천 미리보기 */}
      <TodayPreview assignments={assignments} exams={exams} />
    </div>
  );
}
