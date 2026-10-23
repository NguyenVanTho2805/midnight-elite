// Bài tập & đề thi của học sinh (Figma "Học sinh · Bài tập và đề thi" 299:114951).
import type { Metadata } from "next";
import BaiTapDeThi from "@/components/student/BaiTapDeThi";

export const metadata: Metadata = { title: "Bài tập & đề thi — KiN" };

export default function BaiTapPage() {
  return <BaiTapDeThi />;
}
