// FE-099 — Tra cứu điểm chuẩn: dữ liệu thật từ cơ sở dữ liệu, mỗi dòng kèm đường dẫn nguồn (quản trị nhập ở /admin/diem-chuan).
// NC2-050 — kèm công cụ "Tính điểm xét tuyển" theo công thức quản trị nhập ở /admin/diem-chuan/cong-thuc (chỉ mang tính tham khảo).
import type { Metadata } from "next";
import { loadPublicScores } from "@/lib/admissionScoreServer";
import { loadPublicFormulas } from "@/lib/admissionFormulaServer";
import DiemChuanClient from "./DiemChuanClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tra cứu điểm chuẩn đại học — KiN",
  description: "Điểm chuẩn các trường đại học có dẫn nguồn từng dòng, ghi rõ thang điểm và phương thức xét tuyển.",
};

export default async function DiemChuanPage() {
  // NC2-050: công thức tính điểm. Lỗi đọc công thức (vd bảng mới chưa được tạo ở môi trường này) không được làm hỏng bảng điểm chuẩn đang chạy → coi như chưa có công thức.
  const [{ rows }, formulas] = await Promise.all([loadPublicScores(), loadPublicFormulas().catch(() => [])]);
  return <DiemChuanClient rows={rows} formulas={formulas} />;
}
