// FE-099 — Tra cứu điểm chuẩn: dữ liệu thật từ cơ sở dữ liệu, mỗi dòng kèm đường dẫn nguồn (quản trị nhập ở /admin/diem-chuan).
import type { Metadata } from "next";
import { loadPublicScores } from "@/lib/admissionScoreServer";
import DiemChuanClient from "./DiemChuanClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tra cứu điểm chuẩn đại học — KiN",
  description: "Điểm chuẩn các trường đại học có dẫn nguồn từng dòng, ghi rõ thang điểm và phương thức xét tuyển.",
};

export default async function DiemChuanPage() {
  const { rows } = await loadPublicScores();
  return <DiemChuanClient rows={rows} />;
}
