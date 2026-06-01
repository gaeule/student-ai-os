"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Pencil, Trash2, GraduationCap, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getExams, createExam, updateExam, deleteExam } from "@/lib/actions/exams";
import type { Exam, ExamType, Subject } from "@/types";

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm: "중간고사",
  final: "기말고사",
  quiz: "쪽지시험",
  practical: "실기",
};

type FormState = {
  subjectId: string | null;
  examType: ExamType;
  examDate: Date | undefined;
  scope: string;
  prepDays: number;
};

const DEFAULT_FORM: FormState = {
  subjectId: null,
  examType: "midterm",
  examDate: undefined,
  scope: "",
  prepDays: 3,
};

function ExamForm({
  value,
  onChange,
  subjects,
  calOpen,
  setCalOpen,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  subjects: Subject[];
  calOpen: boolean;
  setCalOpen: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>과목 <span className="text-muted-foreground text-xs">(선택)</span></Label>
        <Select value={value.subjectId} onValueChange={(v) => onChange({ ...value, subjectId: v })}>
          <SelectTrigger className="w-full">
            <span className={value.subjectId ? undefined : "text-muted-foreground"}>
              {value.subjectId ? (subjects.find((s) => s.id === value.subjectId)?.name ?? "과목 선택") : "과목 선택"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>시험 유형 <span className="text-destructive">*</span></Label>
          <Select value={value.examType} onValueChange={(v) => onChange({ ...value, examType: v as ExamType })}>
            <SelectTrigger className="w-full">
              <span>{EXAM_TYPE_LABEL[value.examType]}</span>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(EXAM_TYPE_LABEL) as [ExamType, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>준비 기간</Label>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={1}
              max={30}
              value={value.prepDays}
              onChange={(e) => onChange({ ...value, prepDays: Number(e.target.value) })}
              className="pr-8"
            />
            <span className="text-muted-foreground pointer-events-none absolute right-3 text-sm">일</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>시험 날짜 <span className="text-destructive">*</span></Label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !value.examDate && "text-muted-foreground"
                )}
              >
                <span>{value.examDate ? format(value.examDate, "PPP", { locale: ko }) : "날짜 선택"}</span>
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.examDate}
              onSelect={(date) => {
                if (date) { onChange({ ...value, examDate: date }); setCalOpen(false); }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label>시험 범위 <span className="text-muted-foreground text-xs">(선택)</span></Label>
        <Input
          placeholder="예: 1~5장, 강의 1~8주차"
          value={value.scope}
          onChange={(e) => onChange({ ...value, scope: e.target.value })}
        />
      </div>
    </div>
  );
}

export function ExamsClient({
  initialExams,
  initialSubjects,
}: {
  initialExams: Exam[];
  initialSubjects: Subject[];
}) {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [subjects] = useState<Subject[]>(initialSubjects);
  const [actionError, setActionError] = useState("");
  const [isPending, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM);
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);

  function refresh() {
    getExams().then(setExams).catch(() => setActionError("목록 갱신에 실패했습니다. 새로고침해주세요."));
    router.refresh();
  }

  function handleCreate() {
    if (!form.examDate) { setFormError("시험 날짜를 선택해주세요"); return; }
    setFormError("");
    startTransition(async () => {
      const { error } = await createExam({
        subjectId: form.subjectId,
        examType: form.examType,
        examDate: form.examDate!,
        scope: form.scope || null,
        prepDays: form.prepDays,
      });
      if (error) { setFormError(error); return; }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      refresh();
    });
  }

  function handleEditStart(exam: Exam) {
    setEditingId(exam.id);
    setEditForm({
      subjectId: exam.subjectId,
      examType: exam.examType,
      examDate: exam.examDate,
      scope: exam.scope ?? "",
      prepDays: exam.prepDays,
    });
  }

  function handleUpdate() {
    if (!editingId || !editForm.examDate) return;
    setActionError("");
    startTransition(async () => {
      const { error } = await updateExam(editingId, {
        subjectId: editForm.subjectId,
        examType: editForm.examType,
        examDate: editForm.examDate!,
        scope: editForm.scope || null,
        prepDays: editForm.prepDays,
      });
      if (error) { setActionError(error); return; }
      setEditingId(null);
      refresh();
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`"${label}" 시험 일정을 삭제할까요?`)) return;
    setActionError("");
    startTransition(async () => {
      const { error } = await deleteExam(id);
      if (error) { setActionError(error); return; }
      refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">시험 일정</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">시험 일정을 등록하면 AI 추천에 반영됩니다.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          시험 추가
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border-border mb-6 rounded-xl border p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold">새 시험</h3>
          <ExamForm value={form} onChange={setForm} subjects={subjects} calOpen={calendarOpen} setCalOpen={setCalendarOpen} />
          {formError && <p className="text-destructive text-sm">{formError}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); }}>취소</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={isPending}>등록</Button>
          </div>
        </div>
      )}

      {actionError && <p className="text-destructive text-sm mb-4">{actionError}</p>}

      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <GraduationCap className="text-muted-foreground h-6 w-6" />
          </div>
          <p className="text-foreground font-medium">등록된 시험이 없습니다</p>
          <p className="text-muted-foreground mt-1 text-sm">시험 추가 버튼을 눌러 등록해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) =>
            editingId === exam.id ? (
              <div key={exam.id} className="bg-card border-border rounded-xl border p-5 shadow-sm space-y-3">
                <ExamForm value={editForm} onChange={setEditForm} subjects={subjects} calOpen={editCalendarOpen} setCalOpen={setEditCalendarOpen} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingId(null)}>취소</Button>
                  <Button className="flex-1" onClick={handleUpdate} disabled={isPending}>저장</Button>
                </div>
              </div>
            ) : (
              <div key={exam.id} className="bg-card border-border flex items-center justify-between rounded-xl border p-5 shadow-sm">
                <div>
                  <p className="font-medium">
                    {exam.subjectName ?? "과목 미지정"} — {EXAM_TYPE_LABEL[exam.examType]}
                  </p>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {format(exam.examDate, "PPP", { locale: ko })}
                    {exam.scope && ` · ${exam.scope}`}
                    {` · 준비 ${exam.prepDays}일`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleEditStart(exam)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(exam.id, `${exam.subjectName ?? "과목 미지정"} ${EXAM_TYPE_LABEL[exam.examType]}`)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
