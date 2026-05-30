import { getAssignments } from "@/lib/actions/assignments";
import { AssignmentsContainer } from "./_components/AssignmentsContainer";

export default async function AssignmentsPage() {
  const assignments = await getAssignments();

  return (
    <div className="mx-auto max-w-3xl">
      <AssignmentsContainer assignments={assignments} />
    </div>
  );
}
