import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCM 마을 경제 RPG (데모)",
  description: "자동 작업·제작·거래·전투가 이어지는 판타지 마을 경제 RPG 프로토타입",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
