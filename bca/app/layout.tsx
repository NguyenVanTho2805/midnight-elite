import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const font = Be_Vietnam_Pro({ subsets: ["vietnamese", "latin"], weight: ["400", "600", "800"], variable: "--font-be-vietnam" });

export const metadata: Metadata = { title: "BCA Midnight", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
