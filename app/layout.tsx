import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_KR({ weight: ["600", "700"], subsets: ["latin"], preload: false, variable: "--font-serif" });

export const metadata: Metadata = {
  title: "MCM 마을 경제 RPG (데모)",
  description: "자동 작업·제작·거래·전투가 이어지는 판타지 마을 경제 RPG 프로토타입",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
