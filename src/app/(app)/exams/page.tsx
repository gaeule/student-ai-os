import { getExams } from "@/lib/actions/exams";
import { getSubjects } from "@/lib/actions/subjects";
import { ExamsClient } from "./_components/ExamsClient";

export default async function ExamsPage() {
  const [exams, subjects] = await Promise.all([getExams(), getSubjects()]);

  return (
    <div className="mx-auto max-w-2xl">
      <ExamsClient initialExams={exams} initialSubjects={subjects} />
    </div>
  );
}
