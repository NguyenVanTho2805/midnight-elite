// TT-199 giai đoạn 1 — phiếu học phí riêng, mở bằng link gia sư gửi qua Zalo, không cần tài khoản.
// Link hết hạn sau 30 ngày (Thọ chốt 12/10). Thẻ xem trước của link (Open Graph) CHỈ có chữ chung — không tên con, không số tiền.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { presentInvoiceForParty } from "@/lib/invoiceServer";
import { PARENT_VISIBLE_STATUSES } from "@/lib/tuitionInvoice";
import InvoiceCard from "@/components/parent/InvoiceCard";
import ViewedBeacon from "@/components/parent/ViewedBeacon";

export const dynamic = "force-dynamic"; // link cá nhân, không cache

export const metadata: Metadata = {
  title: "Phiếu học phí — KiN",
  description: "Mở để xem phiếu học phí và mã chuyển khoản.",
  robots: { index: false, follow: false },
  openGraph: { title: "Phiếu học phí — KiN", description: "Mở để xem phiếu học phí và mã chuyển khoản." },
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: "var(--kin-nen-trang)" }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <div role="status" className="rounded-xl p-6 text-center" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{title}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--kin-chu-phu)" }}>{body}</p>
        </div>
      </div>
    </div>
  );
}

export default async function PhieuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidPortalToken(token)) notFound();

  const inv = await prisma.tuitionInvoice.findFirst({
    where: { viewToken: token },
    include: { tutor: { select: { name: true, payoutAccount: true } }, student: { select: { name: true } } },
  });
  if (!inv) notFound();
  const now = new Date();
  if (!inv.viewTokenExpiresAt || inv.viewTokenExpiresAt.getTime() <= now.getTime()) {
    return <Notice title="Link đã hết hạn" body="Link phiếu học phí chỉ dùng được trong 30 ngày. Anh/chị nhắn gia sư để được gửi lại link mới." />;
  }
  if (inv.status === "cancelled") return <Notice title="Phiếu đã được huỷ" body="Gia sư đã huỷ phiếu này. Anh/chị liên hệ gia sư nếu cần biết thêm." />;
  if (!(PARENT_VISIBLE_STATUSES as string[]).includes(inv.status)) notFound(); // nháp: chưa gửi cho phụ huynh

  const view = presentInvoiceForParty(inv, { tutorName: inv.tutor.name, studentName: inv.student.name, account: inv.tutor.payoutAccount });
  return (
    <div style={{ background: "var(--kin-nen-trang)" }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-5">
          <p className="text-caption" style={{ color: "var(--kin-chu-phu)" }}>Kính gửi anh/chị,</p>
          <h1 className="mt-1 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Phiếu học phí của con: {inv.student.name}</h1>
        </header>
        <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-bang)" }}>
          <InvoiceCard plain invoice={view} reportUrl={`/api/phieu/${token}/reported`} />
        </div>
        <ViewedBeacon url={`/api/phieu/${token}/viewed`} />
      </div>
    </div>
  );
}
