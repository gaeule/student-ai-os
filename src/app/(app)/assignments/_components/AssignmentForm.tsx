"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, ImageIcon, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createAssignment, updateAssignment } from "@/lib/actions/assignments";
import { parseAssignmentImage } from "@/lib/actions/image-parse";
import type { Assignment, Subject } from "@/types";

const formSchema = z.object({
  title: z.string().min(1, "과제명을 입력해주세요"),
  subjectId: z.string().min(1, "과목을 선택해주세요"),
  dueDate: z.date({ error: "마감일을 선택해주세요" }),
  difficulty: z.enum(["hard", "medium", "easy"] as const),
  estimatedHours: z
    .number({ error: "숫자를 입력해주세요" })
    .min(0.5, "최소 0.5시간 이상이어야 합니다")
    .max(100, "100시간을 초과할 수 없습니다"),
});

type FormValues = z.infer<typeof formSchema>;
type Difficulty = "hard" | "medium" | "easy";

const DIFFICULTY_OPTIONS: {
  value: Difficulty;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    value: "hard",
    label: "상",
    active: "bg-red-500 text-white border-red-500",
    inactive: "text-red-600 border-red-300 bg-red-50 hover:bg-red-100",
  },
  {
    value: "medium",
    label: "중",
    active: "bg-yellow-500 text-white border-yellow-500",
    inactive: "text-yellow-600 border-yellow-300 bg-yellow-50 hover:bg-yellow-100",
  },
  {
    value: "easy",
    label: "하",
    active: "bg-green-500 text-white border-green-500",
    inactive: "text-green-600 border-green-300 bg-green-50 hover:bg-green-100",
  },
];

type Props = {
  subjects: Subject[];
  assignment?: Assignment; // edit 모드
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function AssignmentForm({ subjects, assignment, onSuccess, onCancel }: Props) {
  const isEdit = !!assignment;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parseError, setParseError] = useState("");
  const [isParsing, startParsing] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          title: assignment.title,
          subjectId: assignment.subjectId ?? undefined,
          dueDate: assignment.dueDate,
          difficulty: assignment.difficulty,
          estimatedHours: assignment.estimatedHours,
        }
      : undefined,
  });

  const selectedDifficulty = watch("difficulty");
  const selectedDate = watch("dueDate");

  // 언마운트 시 object URL 해제
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setParseError("");
  }

  function handleImageRemove() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleParseImage() {
    if (!imageFile) return;
    setParseError("");

    startParsing(async () => {
      const formData = new FormData();
      formData.append("image", imageFile);
      const { data, error } = await parseAssignmentImage(formData);

      if (error) {
        setParseError(error);
        return;
      }
      if (!data) return;

      setValue("title", data.title, { shouldValidate: true });
      // AI가 추출한 과목명과 일치하는 subject 찾기
      const matched = subjects.find((s) =>
        s.name.toLowerCase().includes(data.subject.toLowerCase()) ||
        data.subject.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matched) setValue("subjectId", matched.id, { shouldValidate: true });

      setValue("difficulty", data.difficulty, { shouldValidate: true });
      setValue("estimatedHours", data.estimatedHours, { shouldValidate: true });
      const [y, m, d] = data.dueDate.split("-").map(Number);
      setValue("dueDate", new Date(y, m - 1, d), { shouldValidate: true });
    });
  }

  const onSubmit = async (data: FormValues) => {
    setServerError("");

    if (isEdit) {
      const { error } = await updateAssignment(assignment.id, data);
      if (error) { setServerError(error); return; }
    } else {
      const { error } = await createAssignment(data);
      if (error) { setServerError(error); return; }
      reset();
    }

    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 이미지 업로드 (등록 모드에서만) */}
      {!isEdit && (
        <div className="space-y-2">
          <Label>이미지로 자동 입력 <span className="text-muted-foreground text-xs">(선택)</span></Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageChange}
          />
          {!imagePreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <ImageIcon className="h-4 w-4" />
              과제 캡처 이미지 업로드
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="업로드된 이미지"
                  className="h-32 w-auto rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={handleImageRemove}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleParseImage}
                disabled={isParsing}
              >
                {isParsing ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />분석 중...</>
                ) : (
                  "AI로 자동 입력"
                )}
              </Button>
              {parseError && <p className="text-destructive text-sm">{parseError}</p>}
            </div>
          )}
        </div>
      )}

      {/* 과제명 */}
      <div className="space-y-1.5">
        <Label htmlFor="title">
          과제명 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder="예: 알고리즘 과제 3번"
          {...register("title")}
          className={cn(errors.title && "border-destructive")}
        />
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </div>

      {/* 과목 */}
      <div className="space-y-1.5">
        <Label htmlFor="subjectId">
          과목 <span className="text-destructive">*</span>
        </Label>
        <Controller
          name="subjectId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || null}
              onValueChange={(val) => field.onChange(val)}
            >
              <SelectTrigger
                className={cn("w-full", errors.subjectId && "border-destructive")}
              >
                <SelectValue placeholder="과목 선택" />
              </SelectTrigger>
              <SelectContent>
                {subjects.length === 0 ? (
                  <div className="py-2 text-center text-sm text-muted-foreground">
                    과목을 먼저 등록해주세요
                  </div>
                ) : (
                  subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        />
        {errors.subjectId && (
          <p className="text-destructive text-sm">{errors.subjectId.message}</p>
        )}
      </div>

      {/* 마감일 */}
      <div className="space-y-1.5">
        <Label>
          마감일 <span className="text-destructive">*</span>
        </Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="마감일 선택"
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm whitespace-nowrap transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !selectedDate && "text-muted-foreground",
                  errors.dueDate && "border-destructive"
                )}
              >
                <span>
                  {selectedDate
                    ? format(selectedDate, "PPP", { locale: ko })
                    : "날짜 선택"}
                </span>
                <CalendarIcon className="h-4 w-4 opacity-50" />
              </button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setValue("dueDate", date, { shouldValidate: true });
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
            />
          </PopoverContent>
        </Popover>
        {errors.dueDate && (
          <p className="text-destructive text-sm">{errors.dueDate.message}</p>
        )}
      </div>

      {/* 난이도 */}
      <div className="space-y-1.5">
        <Label>
          난이도 <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map(({ value, label, active, inactive }) => {
            const isActive = selectedDifficulty === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setValue("difficulty", value, { shouldValidate: true })
                }
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  isActive ? active : inactive
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {errors.difficulty && (
          <p className="text-destructive text-sm">{errors.difficulty.message}</p>
        )}
      </div>

      {/* 예상 소요시간 */}
      <div className="space-y-1.5">
        <Label htmlFor="estimatedHours">
          예상 소요시간 <span className="text-destructive">*</span>
        </Label>
        <div className="relative flex items-center">
          <Input
            id="estimatedHours"
            type="number"
            min={0.5}
            max={100}
            step={0.5}
            placeholder="예: 3"
            className={cn("pr-12", errors.estimatedHours && "border-destructive")}
            {...register("estimatedHours", { valueAsNumber: true })}
          />
          <span className="text-muted-foreground pointer-events-none absolute right-3 text-sm">
            시간
          </span>
        </div>
        {errors.estimatedHours && (
          <p className="text-destructive text-sm">{errors.estimatedHours.message}</p>
        )}
      </div>

      {serverError && (
        <p className="text-destructive text-sm">{serverError}</p>
      )}

      <div className="flex gap-2">
        {isEdit && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? (isEdit ? "저장 중..." : "등록 중...") : (isEdit ? "저장" : "과제 등록")}
        </Button>
      </div>
    </form>
  );
}
