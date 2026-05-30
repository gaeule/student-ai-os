"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

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
import { createAssignment } from "@/lib/actions/assignments";

// ---- 스키마 ----
const formSchema = z.object({
  title: z.string().min(1, "과제명을 입력해주세요"),
  subject: z.string().min(1, "과목을 선택해주세요"),
  dueDate: z.date({ error: "마감일을 선택해주세요" }),
  difficulty: z.enum(["hard", "medium", "easy"] as const),
  estimatedHours: z
    .number({ error: "숫자를 입력해주세요" })
    .min(0.5, "최소 0.5시간 이상이어야 합니다")
    .max(100, "100시간을 초과할 수 없습니다"),
});

type FormValues = z.infer<typeof formSchema>;
type Difficulty = "hard" | "medium" | "easy";

const SUBJECTS = [
  "알고리즘",
  "운영체제",
  "데이터베이스",
  "네트워크",
  "소프트웨어공학",
  "컴퓨터구조",
  "기타",
];

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

export function AssignmentForm({ onSuccess }: { onSuccess?: () => void }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [serverError, setServerError] = useState("");

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
  });

  const selectedDifficulty = watch("difficulty");
  const selectedDate = watch("dueDate");

  const onSubmit = async (data: FormValues) => {
    setServerError("");
    const { error } = await createAssignment(data);

    if (error) {
      setServerError(error);
      return;
    }

    reset();
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
        <Label htmlFor="subject">
          과목 <span className="text-destructive">*</span>
        </Label>
        <Controller
          name="subject"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || null}
              onValueChange={(val) => field.onChange(val)}
            >
              <SelectTrigger
                className={cn("w-full", errors.subject && "border-destructive")}
              >
                <SelectValue placeholder="과목 선택" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.subject && (
          <p className="text-destructive text-sm">{errors.subject.message}</p>
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

      {/* 서버 에러 */}
      {serverError && (
        <p className="text-destructive text-sm">{serverError}</p>
      )}

      {/* 제출 */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "등록 중..." : "과제 등록"}
      </Button>
    </form>
  );
}
