// FE-153 — doanh thu của gia sư (học phí đã thu). Chỉ gia sư.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DoanhThuClient from "./DoanhThuClient";

export const dynamic = "force-dynamic";

export default async function DoanhThuGiaSuPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?next=/lop-cua-toi/doanh-thu");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student/hoc-phi" : "/lop-cua-toi");
  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href="/lop-cua-toi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Lớp của tôi</Link>
        <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Doanh thu của tôi</h1>
        <p className="text-caption mt-1 mb-5" style={{ color: "var(--kin-chu-phu)" }}>
          Học phí đã thu vào tài khoản của bạn, tính từ các phiếu đã gạch. KiN không giữ tiền và không cắt phần trăm.
        </p>
        <DoanhThuClient />
      </div>
    </div>
  );
}
