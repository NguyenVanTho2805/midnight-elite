// BU-00 bước 3 — bí danh gia sư của khoa-hoc. Điều hướng A4 (07/11/2026): danh sách lớp phụ này TRÙNG danh sách "Lớp" (/lop-cua-toi/lop) nên chỉ còn là cửa chuyển hướng 307.
// GIỮ route quan-lop/[id]: link thông báo đã lưu trong DB trỏ vào đó. ?tao=1 (liên kết cũ "Tạo lớp") → TaoLop, nơi duy nhất chọn được cách tính học phí (HOCPHI-THEO-BUOI).
import { redirect } from "next/navigation";
import { toTutorPath } from "@/lib/tutorRoutes";

export default async function QuanLopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const s = q.toString();
  redirect(toTutorPath("/admin/khoa-hoc" + (s ? "?" + s : "")) ?? "/lop-cua-toi/lop");
}
