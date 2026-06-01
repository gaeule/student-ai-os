"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSubjects, createSubject, updateSubject, deleteSubject } from "@/lib/actions/subjects";
import type { Subject } from "@/types";

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  // 신규 등록 폼
  const [newName, setNewName] = useState("");
  const [newProfessor, setNewProfessor] = useState("");
  const [newSemester, setNewSemester] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  // 수정 폼
  const [editName, setEditName] = useState("");
  const [editProfessor, setEditProfessor] = useState("");
  const [editSemester, setEditSemester] = useState("");

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch(() => setLoadError("과목 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    getSubjects()
      .then(setSubjects)
      .catch(() => setActionError("목록 갱신에 실패했습니다. 새로고침해주세요."));
    router.refresh();
  }

  function handleCreate() {
    if (!newName.trim()) { setFormError("과목명을 입력해주세요"); return; }
    setFormError("");
    startTransition(async () => {
      const { error } = await createSubject({ name: newName.trim(), professor: newProfessor || null, semester: newSemester || null });
      if (error) { setFormError(error); return; }
      setNewName(""); setNewProfessor(""); setNewSemester(""); setShowForm(false);
      refresh();
    });
  }

  function handleEditStart(s: Subject) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditProfessor(s.professor ?? "");
    setEditSemester(s.semester ?? "");
  }

  function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    setActionError("");
    startTransition(async () => {
      const { error } = await updateSubject(editingId, { name: editName.trim(), professor: editProfessor || null, semester: editSemester || null });
      if (error) { setActionError(error); return; }
      setEditingId(null);
      refresh();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 과목을 삭제할까요?\n해당 과목의 과제는 과목 정보가 초기화됩니다.`)) return;
    setActionError("");
    startTransition(async () => {
      const { error } = await deleteSubject(id);
      if (error) { setActionError(error); return; }
      refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">과목 관리</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">수강 중인 과목을 등록하세요.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          과목 추가
        </Button>
      </div>

      {/* 신규 등록 폼 */}
      {showForm && (
        <div className="bg-card border-border mb-6 rounded-xl border p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold">새 과목</h3>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>과목명 *</Label>
              <Input placeholder="예: 운영체제" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>교수명 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                <Input placeholder="예: 홍길동" value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>학기 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                <Input placeholder="예: 2026-1" value={newSemester} onChange={(e) => setNewSemester(e.target.value)} />
              </div>
            </div>
          </div>
          {formError && <p className="text-destructive text-sm">{formError}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>취소</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={isPending}>등록</Button>
          </div>
        </div>
      )}

      {actionError && (
        <p className="text-destructive text-sm mb-4">{actionError}</p>
      )}

      {/* 과목 목록 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <p className="text-destructive text-center py-10 text-sm">{loadError}</p>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <BookOpen className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-foreground font-medium">등록된 과목이 없습니다</p>
          <p className="text-muted-foreground mt-1 text-sm">과목 추가 버튼을 눌러 등록해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="bg-card border-border rounded-xl border p-5 shadow-sm space-y-3">
                <div className="space-y-1.5">
                  <Label>과목명 *</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>교수명</Label>
                    <Input value={editProfessor} onChange={(e) => setEditProfessor(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>학기</Label>
                    <Input value={editSemester} onChange={(e) => setEditSemester(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingId(null)}>취소</Button>
                  <Button className="flex-1" onClick={handleUpdate} disabled={isPending}>저장</Button>
                </div>
              </div>
            ) : (
              <div key={s.id} className="bg-card border-border flex items-center justify-between rounded-xl border p-5 shadow-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  {(s.professor || s.semester) && (
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {[s.professor, s.semester].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditStart(s)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.name)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
