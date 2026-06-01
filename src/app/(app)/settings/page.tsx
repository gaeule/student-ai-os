import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./_components/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">설정</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">계정 정보를 확인합니다.</p>
      </div>
      <SettingsClient user={user} />
    </div>
  );
}
