"use client";

import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const pageTitles: Record<string, string> = {
  "/dashboard": "대시보드",
  "/assignments": "과제 관리",
  "/today": "오늘 할 일",
  "/subjects": "과목 관리",
  "/settings": "설정",
};

function getPageTitle(pathname: string): string {
  for (const [key, title] of Object.entries(pageTitles)) {
    if (pathname === key || pathname.startsWith(key + "/")) return title;
  }
  return "학생 AI OS";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="border-border bg-background flex h-14 shrink-0 items-center justify-between border-b px-6">
      <h1 className="text-foreground text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          베타
        </Badge>
        <Avatar className="h-8 w-8">
          <AvatarImage src="" alt="사용자" />
          <AvatarFallback className="text-xs">나</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
