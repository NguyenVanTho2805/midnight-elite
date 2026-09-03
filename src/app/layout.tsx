import type { Metadata } from "next";
import { Be_Vietnam_Pro, Space_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AgentationWrapper from "@/components/AgentationWrapper";
import { GlobalDropGuard } from "@/components/GlobalDropGuard";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Midnight Elite — Luyện thi ĐGNL & Tốt nghiệp THPT",
  description: "Nền tảng luyện thi ĐGNL (HSA, HCM, Bách Khoa) và Tốt nghiệp THPT hàng đầu Việt Nam. Học video bài giảng, thi thử, hỏi AI 24/7.",
  keywords: ["ĐGNL", "luyện thi", "HSA", "tốt nghiệp THPT", "học online", "Midnight Elite"],
  openGraph: {
    title: "Midnight Elite",
    description: "Chinh phục ĐGNL & Tốt nghiệp THPT cùng Midnight Elite",
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
      className={`${sans.variable} ${spaceMono.variable} h-full scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
    try {
      var t = localStorage.getItem('midnight-theme');
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    } catch (e) {}
  `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
          <GlobalDropGuard />
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
          <AgentationWrapper />
        </body>
    </html>
  );
}
