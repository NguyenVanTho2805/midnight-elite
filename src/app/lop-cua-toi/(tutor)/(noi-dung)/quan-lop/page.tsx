// BU-00 bước 3 — trang mỏng: bí danh gia sư của khoa-hoc (vỏ gia sư do (tutor)/layout + (noi-dung)/layout cấp). Không sửa trang gốc ở đây.
// HOCPHI-THEO-BUOI (TUT-001): ?tao=1 (liên kết cũ "Tạo lớp") chuyển 307 sang TaoLop, nơi duy nhất chọn được cách tính học phí; ngoài ra vẫn là trang gốc.
import { redirect } from "next/navigation";
import KhoaHocPage from "@/app/(admin)/admin/khoa-hoc/page";

export default async function QuanLopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (sp.tao === "1") redirect("/lop-cua-toi/lop/tao");
  return <KhoaHocPage />;
}
