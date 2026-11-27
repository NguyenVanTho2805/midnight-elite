import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({ subsets: ["vietnamese", "latin"], weight: ["400", "600", "800"], variable: "--font-be-vietnam" });

export const metadata: Metadata = { title: "BCA Midnight", robots: { index: false } };
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F1F4FA" }, { media: "(prefers-color-scheme: dark)", color: "#0C1226" }], colorScheme: "light dark", viewportFit: "cover" };

// Chạy trước khi vẽ để không nháy màu: lựa chọn đã lưu, không có thì theo máy.
// shortcut: máy đổi sáng/tối khi trang đang mở thì phải tải lại mới theo; thêm listener matchMedia nếu có người phàn nàn.
const DAT_GIAO_DIEN = `try{document.documentElement.dataset.theme=localStorage.getItem("bca-giao-dien")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: DAT_GIAO_DIEN }} /></head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
