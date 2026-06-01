import { getSubjects } from "@/lib/actions/subjects";
import { SubjectsClient } from "./_components/SubjectsClient";

export default async function SubjectsPage() {
  const subjects = await getSubjects();

  return (
    <div className="mx-auto max-w-2xl">
      <SubjectsClient initialSubjects={subjects} />
    </div>
  );
}
