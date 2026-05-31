import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "학생 AI OS",
  description: "대학생을 위한 AI 과제 비서",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
