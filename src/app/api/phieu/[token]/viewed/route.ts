// TT-199 — ghi "Phụ huynh đã xem" khi người thật mở trang phiếu. Gọi từ trình duyệt (không phải lúc máy chủ dựng trang),
// để bot xem trước link của Zalo không làm phiếu bị đánh dấu đã xem.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { limitOrBlock } from "@/lib/rate-limit";
import { ZALO_SENDABLE_STATUSES } from "@/lib/invoiceZalo";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidPortalToken(token)) return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  const blocked = limitOrBlock(token, "phieu-viewed", 60, 60 * 60_000);
  if (blocked) return blocked;
  const now = new Date();
  // Chỉ lần đầu; chỉ khi link còn hạn; nháp/đã huỷ không ghi.
  const r = await prisma.tuitionInvoice.updateMany({
    where: { viewToken: token, viewTokenExpiresAt: { gt: now }, parentViewedAt: null, status: { in: [...ZALO_SENDABLE_STATUSES, "paid"] } },
    data: { parentViewedAt: now },
  });
  return NextResponse.json({ ok: true, first: r.count === 1 });
}
