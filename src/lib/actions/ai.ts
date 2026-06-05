"use server";

import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import type { StudyBlock } from "@/lib/studyPlan";

const MAX_RECOMMENDATIONS = 10;
const MAX_TITLE_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 50;

/**
 * LLM 응답에 섞인 일본어 문자(히라가나·가타카나·일본어 구두점)를 제거하고
 * 제거 후 남는 고립 구두점을 정리합니다.
 *
 * 처리 순서:
 *  1. 일본어 구두점(、。) → 공백 치환 (문장 붙음 방지)
 *  2. 히라가나(U+3040–309F), 가타카나(U+30A0–30FF) 제거
 *  3. 구두점 직후 고립 쉼표 정리: "같다.," / "같다. ," → "같다. "
 *  4. 쉼표 직전 구두점 정리: ",." → ". "
 *  5. 연속 공백 → 단일 공백
 *  6. 선두/후미 공백·고립 쉼표 제거
 */
function stripJapanese(text: string): string {
  return text
    .replace(/[\u3001\u3002]/g, " ")        // 、。→ 공백 (문장 붙음 방지)
    .replace(/[\u3040-\u309F\u30A0-\u30FF]/g, "")
    .replace(/([.!?])\s*,+\s*/g, "$1 ")    // "같다.," / "같다. ," → "같다. "
    .replace(/,+\s*([.!?])/g, " $1")        // ",." → " ."
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,]+\s*/, "");               // 선두 고립 쉼표 제거
}

export async function getAIComment(
  scheduled: StudyBlock[],
  availableHours: number
): Promise<{ comment: string | null; error: string | null }> {
  // [P1] 인증 재확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { comment: null, error: "로그인이 필요합니다." };

  if (scheduled.length === 0) {
    return { comment: null, error: null };
  }

  // [P1] 입력 길이 제한
  const clamped = scheduled.slice(0, MAX_RECOMMENDATIONS);

  const blockSummary = clamped
    .map((block, i) => {
      const title = block.title.slice(0, MAX_TITLE_LENGTH);
      const subject = (block.subjectName ?? "기타").slice(0, MAX_SUBJECT_LENGTH);
      if (block.type === "assignment") {
        const diffLabel = { hard: "상", medium: "중", easy: "하" }[block.difficulty];
        const dueLabel =
          block.daysLeft === 0 ? "오늘" :
          block.daysLeft === 1 ? "내일" :
          `${block.daysLeft}일 후`;
        return `${i + 1}. [과제] ${title} (${subject}, 난이도:${diffLabel}, 마감 ${dueLabel}, 배정 ${block.allocatedMinutes}분)`;
      } else {
        const examLabel =
          block.daysLeft === 0 ? "오늘" :
          block.daysLeft === 1 ? "내일" :
          `${block.daysLeft}일 후`;
        return `${i + 1}. [시험복습] ${title} (시험 ${examLabel}, 복습 배정 ${block.allocatedMinutes}분)`;
      }
    })
    .join("\n");

  const userMessage = `오늘 공부 가능 시간: ${availableHours}시간

오늘 추천된 학습 계획:
${blockSummary}

위 계획을 어떤 순서로, 어떻게 접근하면 좋을지 오늘 공부 전략을 2~3문장으로 간결하게 조언해줘. 구체적인 팁 위주로.`;

  // [P1] lazy 생성 — env 미설정 시 모듈 크래시 방지
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { comment: null, error: "AI 서비스가 설정되지 않았습니다." };

  try {
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a Korean university student study coach. CRITICAL: Output ONLY Korean (Hangul). NEVER use Japanese characters (hiragana ぁ-ん, katakana ァ-ン) or Japanese words (まず, では, など, または). Use Korean connectors only: 먼저, 그리고, 또한, 따라서. Analyze the assignments and give a 2~3 sentence study strategy. Warm and practical tone.",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content ?? null;
    const comment = raw ? stripJapanese(raw) : null;
    return { comment, error: null };
  } catch (e) {
    console.error("[Groq error]", e);
    return { comment: null, error: "AI 코멘트를 불러오지 못했습니다." };
  }
}
