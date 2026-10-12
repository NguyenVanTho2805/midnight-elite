// Trang đầu của học sinh sau khi đăng nhập (Figma "Vỏ — Học sinh" 11:98): việc cần làm, hạn nộp, buổi học sắp tới.
import type { Metadata } from "next";
import ViecCuaToi from "@/components/student/ViecCuaToi";

export const metadata: Metadata = { title: "Việc của tôi — KiN" };

export default function ViecCuaToiPage() {
  return <ViecCuaToi />;
}
