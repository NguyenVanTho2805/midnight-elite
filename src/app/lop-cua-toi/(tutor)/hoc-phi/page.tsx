// TT-200 — Học phí của gia sư: phiếu có mã, hàng chờ đối soát, cài đặt nhận tiền.
// Chỉ gia sư (role admin + adminRole teacher). Tiền đi thẳng vào tài khoản gia sư.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import HocPhiClient from "./HocPhiClient";

export const dynamic = "force-dynamic";

export default async function HocPhiGiaSuPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/hoc-phi");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student/hoc-phi" : "/lop-cua-toi");

  const { tab } = await searchParams;
  const initialTab = tab === "doi-soat" || tab === "nhan-tien" ? tab : "phieu";
  const pending = await prisma.bankTransaction.count({ where: { tutorId: session.userId, status: "pending" } });

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href="/lop-cua-toi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Lớp của tôi</Link>
        <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Học phí</h1>
        <p className="text-caption mt-1 mb-5" style={{ color: "var(--kin-chu-phu)" }}>
          Phiếu có mã riêng, tiền chuyển thẳng vào tài khoản của bạn. KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền.
        </p>
        <HocPhiClient initialTab={initialTab} pending={pending} />
      </div>
    </div>
  );
}
