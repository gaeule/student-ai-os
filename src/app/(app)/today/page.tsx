import { getAssignments } from "@/lib/actions/assignments";
import { getExams } from "@/lib/actions/exams";
import { TodayPlanner } from "./_components/TodayPlanner";

export default async function TodayPage() {
  const [assignments, exams] = await Promise.all([getAssignments(), getExams()]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">오늘 할 일</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          마감일 · 난이도 · 예상 소요시간을 종합해 우선순위를 계산합니다.
        </p>
      </div>
      <TodayPlanner assignments={assignments} exams={exams} />
    </div>
  );
}
