"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, List } from "lucide-react";
import { AssignmentForm } from "./AssignmentForm";
import { AssignmentList } from "./AssignmentList";
import { cn } from "@/lib/utils";
import type { Assignment, Subject } from "@/types";

type Tab = "list" | "new";

type Props = {
  assignments: Assignment[];
  subjects: Subject[];
};

export function AssignmentsContainer({ assignments, subjects }: Props) {
  const [tab, setTab] = useState<Tab>("list");
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const router = useRouter();

  function handleFormSuccess() {
    setTab("list");
    setEditingAssignment(null);
    router.refresh();
  }

  function handleEdit(assignment: Assignment) {
    setEditingAssignment(assignment);
    setTab("list");
  }

  function handleCancelEdit() {
    setEditingAssignment(null);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">과제 관리</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            마감일 임박 순으로 정렬됩니다.
          </p>
        </div>

        <div className="bg-muted flex rounded-lg p-1">
          <button
            type="button"
            onClick={() => { setTab("list"); setEditingAssignment(null); }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
            목록
            {assignments.length > 0 && (
              <span className="bg-primary text-primary-foreground ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                {assignments.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setTab("new"); setEditingAssignment(null); }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "new"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Plus className="h-4 w-4" />
            새 과제
          </button>
        </div>
      </div>

      {tab === "list" && !editingAssignment && (
        <AssignmentList assignments={assignments} onEdit={handleEdit} />
      )}

      {tab === "list" && editingAssignment && (
        <div className="mx-auto max-w-xl">
          <div className="bg-card border-border rounded-xl border p-6 shadow-sm">
            <h3 className="text-base font-semibold mb-4">과제 수정</h3>
            <AssignmentForm
              subjects={subjects}
              assignment={editingAssignment}
              onSuccess={handleFormSuccess}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      )}

      {tab === "new" && (
        <div className="mx-auto max-w-xl">
          <div className="bg-card border-border rounded-xl border p-6 shadow-sm">
            <AssignmentForm subjects={subjects} onSuccess={handleFormSuccess} />
          </div>
        </div>
      )}
    </>
  );
}
