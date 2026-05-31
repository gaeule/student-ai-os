"use server";

import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import type { ScoredAssignment } from "@/lib/priority";

const MAX_RECOMMENDATIONS = 10;
const MAX_TITLE_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 50;

export async function getAIComment(
  recommendations: ScoredAssignment[],
  availableHours: number
): Promise<{ comment: string | null; error: string | null }> {
  // [P1] 인증 재확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { comment: null, error: "로그인이 필요합니다." };

  if (recommendations.length === 0) {
    return { comment: null, error: null };
  }

  // [P1] 입력 길이 제한
  const clamped = recommendations
    .slice(0, MAX_RECOMMENDATIONS)
    .map((a) => ({
      ...a,
      title: a.title.slice(0, MAX_TITLE_LENGTH),
      subjectName: (a.subjectName ?? "").slice(0, MAX_SUBJECT_LENGTH),
    }));

  const assignmentSummary = clamped
    .map((a, i) => {
      const diffLabel = { hard: "상", medium: "중", easy: "하" }[a.difficulty];
      return `${i + 1}. ${a.title} (${a.subjectName ?? "기타"}, 난이도:${diffLabel}, 마감 ${a.daysLeft <= 0 ? "초과" : `${a.daysLeft}일 후`}, 오늘 배정 ${a.allocatedHours}h)`;
    })
    .join("\n");

  const userMessage = `오늘 공부 가능 시간: ${availableHours}시간

추천된 과제 목록:
${assignmentSummary}

위 과제들을 어떤 순서로, 어떻게 접근하면 좋을지 오늘 공부 전략을 2~3문장으로 간결하게 조언해줘. 구체적인 팁 위주로.`;

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
            "너는 대학생 학습 코치야. 과제 상황을 분석해서 오늘 공부 전략을 한국어로 조언해줘. 따뜻하고 실용적인 톤으로, 핵심만 2~3문장으로 짧게 말해.",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const comment = response.choices[0]?.message?.content ?? null;
    return { comment, error: null };
  } catch (e) {
    console.error("[Groq error]", e);
    return { comment: null, error: "AI 코멘트를 불러오지 못했습니다." };
  }
}
