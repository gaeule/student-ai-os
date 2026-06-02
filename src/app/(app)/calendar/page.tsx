import { getAssignments } from "@/lib/actions/assignments";
import { getExams } from "@/lib/actions/exams";
import { getSchedules } from "@/lib/actions/schedules";
import { CalendarSection } from "../dashboard/_components/CalendarSection";

export default async function CalendarPage() {
  const [assignments, exams, schedules] = await Promise.all([
    getAssignments(),
    getExams(),
    getSchedules(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">캘린더</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          과제 마감일과 시험 일정을 한눈에 확인하세요.
        </p>
      </div>
      <CalendarSection assignments={assignments} exams={exams} schedules={schedules} />
    </div>
  );
}
