// TK-171 (06/10/2026) — Danh bạ lớp (roster) cho gia sư. Figma 34:2 (desktop), 108:2 (mobile).
// GS-LOP-GON (09/11/2026): toàn bộ giao diện chuyển nguyên văn sang src/components/tutor/DanhBaLop.tsx (cũng dùng cho tab "Học sinh" của lớp gia sư);
// trang này chỉ còn gọi nó. Hành vi + địa chỉ /admin/khoa-hoc/[id]/hoc-vien không đổi.
"use client";
import { use as usePromise } from "react";
import DanhBaLop from "@/components/tutor/DanhBaLop";

export default function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = usePromise(params);
  return <DanhBaLop courseId={courseId} />;
}
