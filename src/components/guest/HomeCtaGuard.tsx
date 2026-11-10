// Bọc khối CTA cuối trang chủ ("Đăng ký"): HTML tĩnh luôn có sẵn cho khách; khi biết chắc đã đăng nhập thì ẨN (người đã có tài khoản không cần nút đăng ký).
// Lúc chưa biết là ai (đang hỏi phiên) vẫn hiện, để khách không thấy khối biến mất rồi hiện lại.
"use client";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { homeBlocksFor, toHomeViewer } from "@/lib/homeLayout";

export default function HomeCtaGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const viewer = toHomeViewer(user, isLoading);
  if (viewer.kind === "loading") return <>{children}</>;
  return homeBlocksFor(viewer, { quiz: false }).ctaFinal ? <>{children}</> : null;
}
