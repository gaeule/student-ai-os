import { getAssignments } from "@/lib/actions/assignments";
import { getSubjects } from "@/lib/actions/subjects";
import { AssignmentsContainer } from "./_components/AssignmentsContainer";

export default async function AssignmentsPage() {
  const [assignments, subjects] = await Promise.all([
    getAssignments(),
    getSubjects(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <AssignmentsContainer assignments={assignments} subjects={subjects} />
    </div>
  );
}
