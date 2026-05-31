"use server";

import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import type { Difficulty } from "@/types";

export type ParsedAssignment = {
  title: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  difficulty: Difficulty;
  estimatedHours: number;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function parseAssignmentImage(
  formData: FormData
): Promise<{ data: ParsedAssignment | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "로그인이 필요합니다." };

  const file = formData.get("image") as File | null;
  if (!file) return { data: null, error: "이미지가 없습니다." };

  if (!ALLOWED_TYPES.includes(file.type))
    return { data: null, error: "JPG, PNG, WEBP 이미지만 지원합니다." };

  if (file.size > MAX_SIZE)
    return { data: null, error: "파일 크기는 5MB 이하여야 합니다." };

  // Supabase Storage 업로드
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("assignment-image")
    .upload(path, arrayBuffer, { contentType: file.type });

  if (uploadError)
    return { data: null, error: "이미지 업로드 실패: " + uploadError.message };

  // Private 버킷이므로 Signed URL 생성 (60초)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("assignment-image")
    .createSignedUrl(path, 60);

  if (signedError || !signedData)
    return { data: null, error: "이미지 URL 생성 실패" };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { data: null, error: "AI 서비스가 설정되지 않았습니다." };

  try {
    const groq = new Groq({ apiKey });
    const today = new Date().toISOString().split("T")[0];

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: signedData.signedUrl },
            },
            {
              type: "text",
              text: `이 이미지에서 과제 정보를 추출해줘. 오늘 날짜는 ${today}야.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.

{
  "title": "과제 제목",
  "subject": "과목명",
  "dueDate": "YYYY-MM-DD",
  "difficulty": "easy|medium|hard",
  "estimatedHours": 숫자
}

- difficulty 기준: easy(1~2시간), medium(3~5시간), hard(6시간 이상)
- estimatedHours: 0.5 단위, 최소 0.5
- 마감일이 없으면 오늘로부터 7일 후로 설정
- 정보를 알 수 없으면 합리적으로 추정해`,
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { data: null, error: "AI 응답 파싱 실패" };

    const parsed = JSON.parse(jsonMatch[0]) as ParsedAssignment;
    if (!parsed.title || !parsed.dueDate)
      return { data: null, error: "과제 정보를 추출하지 못했습니다." };

    return { data: parsed, error: null };
  } catch (e) {
    console.error("[Groq Vision error]", e);
    return { data: null, error: "AI 분석 중 오류가 발생했습니다." };
  }
}
