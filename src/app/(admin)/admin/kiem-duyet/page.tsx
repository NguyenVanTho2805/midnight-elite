// "Chờ kiểm duyệt" (Figma "Vỏ — Quản trị" 11:287): hàng chờ gộp hồ sơ gia sư xin duyệt + các báo cáo, theo quyền từng vai.
import type { Metadata } from "next";
import KiemDuyet from "@/components/admin/KiemDuyet";

export const metadata: Metadata = { title: "Chờ kiểm duyệt — KiN" };

export default function KiemDuyetPage() {
  return <KiemDuyet />;
}
