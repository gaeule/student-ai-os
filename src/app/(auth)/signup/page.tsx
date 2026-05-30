"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";

// Supabase 에러 메시지 → 한국어 변환
function toKoreanError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user_already_exists"))
    return "이미 사용 중인 이메일입니다.";
  if (m.includes("password") && (m.includes("6") || m.includes("short") || m.includes("weak")))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "잠시 후 다시 시도해주세요. (이메일 발송 한도 초과)";
  if (m.includes("invalid") || m.includes("unable to validate"))
    return "이메일 주소를 다시 확인해주세요.";
  if (m.includes("signup") && m.includes("disabled"))
    return "현재 회원가입이 비활성화되어 있습니다.";
  if (m.includes("network") || m.includes("fetch"))
    return "네트워크 오류가 발생했습니다. 연결을 확인해주세요.";
  return message; // 알 수 없는 에러는 원문 그대로
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.error("[Supabase signUp error]", error);
      setError(toKoreanError(error.message));
      setLoading(false);
      return;
    }

    // 이메일 인증 OFF 상태: 세션이 바로 생성됨 → 대시보드로 이동
    if (data.session) {
      window.location.href = "/dashboard";
      return;
    }

    // 이메일 인증 ON 상태: "메일 확인" 화면 표시
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <BookOpen className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">이메일을 확인해 주세요</h2>
          <p className="text-muted-foreground text-sm">
            {email}로 인증 링크를 보냈습니다.
          </p>
          <Link href="/login" className="text-primary text-sm hover:underline">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <BookOpen className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">회원가입</h1>
          <p className="text-muted-foreground mt-1 text-sm">Student AI OS 시작하기</p>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSignup} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="6자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">비밀번호 확인</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "처리 중..." : "가입하기"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
