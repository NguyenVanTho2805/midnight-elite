// TT-200 — Học phí của gia sư: phiếu có mã, hàng chờ đối soát, cài đặt nhận tiền.
// Chỉ gia sư (role admin + adminRole teacher). Tiền đi thẳng vào tài khoản gia sư.
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
      <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 max-w-[1100px]">
        <header className="pb-6">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Học phí</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            Phiếu có mã riêng, tiền chuyển thẳng vào tài khoản của bạn. KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền.
          </p>
        </header>
        <HocPhiClient initialTab={initialTab} pending={pending} />
      </div>
    </div>
  );
}
