import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AgentationWrapper from "@/components/AgentationWrapper";
import { GlobalDropGuard } from "@/components/GlobalDropGuard";
import { ToastProvider } from "@/components/ui";
import { ThemeApplier } from "@/components/ThemeApplier";
import AccountThemeSync from "@/components/AccountThemeSync";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
  display: "swap",
});

// Figma KiN: tiêu đề Be Vietnam Pro, chữ thân Inter, chữ "KiN" cạnh logo Plus Jakarta Sans ExtraBold.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["800"],
  variable: "--font-jakarta",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KiN — Luyện thi ĐGNL & Tốt nghiệp THPT",
  description: "Nền tảng luyện thi ĐGNL (HSA, HCM, Bách Khoa) và Tốt nghiệp THPT hàng đầu Việt Nam. Học video bài giảng, thi thử, hỏi AI 24/7.",
  keywords: ["ĐGNL", "luyện thi", "HSA", "tốt nghiệp THPT", "học online", "KiN"],
  openGraph: {
    title: "KiN",
    description: "Chinh phục ĐGNL & Tốt nghiệp THPT cùng KiN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${sans.variable} ${inter.variable} ${jakarta.variable} ${spaceMono.variable} h-full scroll-smooth`}
      // TK-165 (06/10/2026): mặc định chủ đề Navy. 5 chủ đề: navy / co-vit
      // / man / ca-phe / muc. Khi hệ chủ đề theo tài khoản (TK-167) có,
      // JSX này được thay bằng giá trị user đã chọn (set client-side,
      // suppressHydrationWarning). Không đặt data-che-do → tự theo máy.
      data-chu-de="navy"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased">
          <ThemeApplier />
          <GlobalDropGuard />
          <AuthProvider>
            <AccountThemeSync />
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
          <AgentationWrapper />
        </body>
    </html>
  );
}
