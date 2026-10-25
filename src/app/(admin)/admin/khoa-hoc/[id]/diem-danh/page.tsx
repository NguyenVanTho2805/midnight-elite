// TK-172 — trang điểm danh một lớp. Phần giao diện nằm ở src/components/tutor/DiemDanh.tsx (dùng chung với tab "Buổi học & điểm danh" của trang lớp).
"use client";
import { Suspense, use as usePromise } from "react";
import DiemDanhPanel from "@/components/tutor/DiemDanh";

export default function DiemDanhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  return <Suspense fallback={null}><DiemDanhPanel courseId={id} /></Suspense>;
}
