// TT-199 giai đoạn 1 — gửi phiếu học phí qua Zalo bằng tay.
//   POST { action: "prepare", target: "private" | "group" }
//        private → cấp (hoặc dùng lại) link riêng của phiếu, hết hạn sau 30 ngày; trả path + số điện thoại phụ huynh.
//        group   → chỉ trả dữ liệu cho tin chung; KHÔNG cấp link (ai trong nhóm cũng mở được link).
//   POST { action: "opened" } → ghi "Đã mở Zalo lúc …". KiN không biết tin có đi thật hay không → không ghi "đã gửi".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { requireTutor } from "@/lib/invoiceServer";
import { remainingOf } from "@/lib/tuitionInvoice";
import { generatePortalToken } from "@/lib/parentPortal";
import { ZALO_SENDABLE_STATUSES, invoiceLinkExpiry, invoiceLinkPath, invoiceLinkState } from "@/lib/invoiceZalo";

const NOT_SENDABLE: Record<string, string> = {
  draft: "Hãy gửi phiếu trước (bấm “Gửi phiếu”) rồi mới gửi qua Zalo",
  paid: "Phiếu đã đóng đủ, không cần gửi nữa",
  cancelled: "Phiếu đã huỷ — khôi phục trước khi gửi",
};
const sendable = (s: string) => (ZALO_SENDABLE_STATUSES as readonly string[]).includes(s);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const inv = await prisma.tuitionInvoice.findUnique({
    where: { id },
    include: { student: { select: { id: true, name: true, parentName: true, parentPhone: true } } },
  });
  if (!inv || inv.tutorId !== auth.userId) return NextResponse.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
  if (!sendable(inv.status)) return NextResponse.json({ error: NOT_SENDABLE[inv.status] ?? "Phiếu này chưa gửi được" }, { status: 409 });

  const body = await req.json().catch(() => null) as { action?: unknown; target?: unknown } | null;
  const now = new Date();

  if (body?.action === "opened") {
    const r = await prisma.tuitionInvoice.updateMany({ where: { id, tutorId: auth.userId, status: { in: [...ZALO_SENDABLE_STATUSES] } }, data: { zaloOpenedAt: now } });
    if (r.count === 0) return NextResponse.json({ error: "Phiếu vừa đổi trạng thái, tải lại trang" }, { status: 409 });
    await logAction(auth.userId, "invoice.zalo_opened", "TuitionInvoice", id, { code: inv.code });
    return NextResponse.json({ ok: true, openedAt: now.toISOString() });
  }

  if (body?.action !== "prepare") return NextResponse.json({ error: "action phải là prepare hoặc opened" }, { status: 400 });
  const target = body.target === "group" ? "group" : body.target === "private" ? "private" : null;
  if (!target) return NextResponse.json({ error: "target phải là private hoặc group" }, { status: 400 });

  const base = { yearMonth: inv.yearMonth, studentName: inv.student.name, parentName: inv.student.parentName, amount: remainingOf(inv) };
  if (target === "group") return NextResponse.json({ target, ...base, path: null, phone: null, expiresAt: null });

  let token = inv.viewToken, expiresAt = inv.viewTokenExpiresAt;
  if (invoiceLinkState(inv, now) !== "live") {
    // Chỉ thay khi chưa có/đã hết hạn — hai lần bấm cùng lúc không làm link vừa gửi bị chết.
    const fresh = generatePortalToken(), freshExp = invoiceLinkExpiry(now);
    await prisma.tuitionInvoice.updateMany({
      where: { id, OR: [{ viewToken: null }, { viewTokenExpiresAt: null }, { viewTokenExpiresAt: { lte: now } }] },
      data: { viewToken: fresh, viewTokenExpiresAt: freshExp },
    });
    const cur = await prisma.tuitionInvoice.findUnique({ where: { id }, select: { viewToken: true, viewTokenExpiresAt: true } });
    token = cur?.viewToken ?? null; expiresAt = cur?.viewTokenExpiresAt ?? null;
    await logAction(auth.userId, "invoice.view_link_issue", "TuitionInvoice", id, { code: inv.code });
  }
  if (!token || !expiresAt) return NextResponse.json({ error: "Không tạo được link, thử lại" }, { status: 500 });
  return NextResponse.json({ target, ...base, path: invoiceLinkPath(token), expiresAt: expiresAt.toISOString(), phone: inv.student.parentPhone });
}
