// TT-200 — Học phí của gia sư: phiếu có mã, hàng chờ đối soát, cài đặt nhận tiền.
// Chỉ gia sư (role admin + adminRole teacher). Tiền đi thẳng vào tài khoản gia sư.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import HocPhiClient from "./HocPhiClient";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";

export const dynamic = "force-dynamic";

export default async function HocPhiGiaSuPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/hoc-phi");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect(session.role === "student" ? "/student/hoc-phi" : "/lop-cua-toi");

  const { tab } = await searchParams;
  const initialTab = tab === "doi-soat" || tab === "nhan-tien" ? tab : "phieu";
  const pending = await prisma.bankTransaction.count({ where: { tutorId: session.userId, status: "pending" } });

  return (
    <KinPage>
      <KinPageHeader title="Học phí"
        sub="Phiếu có mã riêng, tiền chuyển thẳng vào tài khoản của bạn. KiN chỉ đọc tiền vào để gạch phiếu, không giữ tiền." />
      <HocPhiClient initialTab={initialTab} pending={pending} />
    </KinPage>
  );
}
