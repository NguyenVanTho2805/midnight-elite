import type { Metadata } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro, Inter, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AgentationWrapper from "@/components/AgentationWrapper";
import { GlobalDropGuard } from "@/components/GlobalDropGuard";
import { ToastProvider } from "@/components/ui";
import { ThemeApplier } from "@/components/ThemeApplier";
import AccountThemeSync from "@/components/AccountThemeSync";
import { RAIL_INIT_SCRIPT } from "@/lib/railState";
import { SHELL_INIT_SCRIPT } from "@/lib/signedInShell";
import { HOST_INIT_SCRIPT } from "@/lib/hostChrome";

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
  description: "Nền tảng học cùng gia sư thật cho luyện thi ĐGNL & Tốt nghiệp THPT.", // chữ của chân trang Figma 152:46
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
          {/* Thanh bên đã thu thì ẩn ngay từ khung hình đầu (xem src/lib/railState.ts); không có dòng này thanh sẽ hiện ra rồi mới thụt vào. */}
          <Script id="kin-rail-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: RAIL_INIT_SCRIPT }} />
          {/* Máy này lần trước đăng nhập → ẩn khung khách (thanh trên + chân trang) từ khung hình đầu, khỏi nháy ra "trang chủ" rồi mới vào vỏ (src/lib/signedInShell.ts). */}
          <Script id="kin-shell-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: SHELL_INIT_SCRIPT }} />
          {/* Tên miền admin không phải trang công khai: ẩn khung khách (thanh trên, chân trang) và nút chỉ dành cho khách ngay từ khung hình đầu (src/lib/hostChrome.ts). */}
          <Script id="kin-host-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: HOST_INIT_SCRIPT }} />
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
