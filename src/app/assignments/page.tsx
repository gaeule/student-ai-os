import { AssignmentForm } from "./_components/AssignmentForm";

export default function AssignmentsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">새 과제 등록</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          AI가 우선순위를 자동으로 분석합니다.
        </p>
      </div>
      <div className="bg-card border-border rounded-xl border p-6 shadow-sm">
        <AssignmentForm />
      </div>
    </div>
  );
}
