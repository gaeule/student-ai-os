"use client";

import { useRouter } from "next/navigation";
import { User, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function SettingsClient({ user }: { user: SupabaseUser | null }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-4">
      {/* 계정 정보 */}
      <div className="bg-card border-border rounded-xl border p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold">계정 정보</h3>
        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full shrink-0">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">이름</p>
              <p className="text-sm font-medium">
                {user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full shrink-0">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">이메일</p>
              <p className="text-sm font-medium">{user?.email ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 로그아웃 */}
      <div className="bg-card border-border rounded-xl border p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold">계정 관리</h3>
        <Separator />
        <Button
          variant="outline"
          className="w-full text-red-600 hover:bg-red-50 hover:text-red-600 border-red-200"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
