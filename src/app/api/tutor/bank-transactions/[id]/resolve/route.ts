// TT-200 — gia sư xử lý 1 khoản tiền trong hàng chờ.
// POST { action, invoiceId?, excess? }
//   not_tuition        "Không phải tiền học": ẩn khỏi hàng chờ, không xoá
//   apply              (đóng thiếu / khớp phiếu nháp) cộng khoản này vào phiếu đã gắn
//   credit_next_month  (dư / phiếu đã đóng / phiếu huỷ) phần dư thành tín dụng, trừ vào phiếu tháng sau
//   refunded           (dư / phiếu đã đóng / phiếu huỷ) ghi đã trả lại phần dư ngoài hệ thống
//   match_invoice      (không mã / mã lạ / …) ghép vào phiếu đã chọn; dư thì bắt buộc
//                      excess: "credit" | "refunded"
// Mọi lần xử lý lưu ai bấm, lúc nào. Khoá theo phiếu + "nhận" khoản bằng
// updateMany có điều kiện status = pending → 2 lần bấm cùng lúc chỉ 1 thành công.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { addCredit, applyToInvoice, lockInvoice, requireTutor } from "@/lib/invoiceServer";
import { OPEN_STATUSES, remainingOf } from "@/lib/tuitionInvoice";

class HttpErr extends Error { constructor(public http: number, public msg: string, public extra?: Record<string, unknown>) { super(msg); } }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;

  const body = await req.json().catch(() => null) as { action?: unknown; invoiceId?: unknown; excess?: unknown } | null;
  const action = body?.action;
  if (!["not_tuition", "apply", "credit_next_month", "refunded", "match_invoice"].includes(action as string)) {
    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  }
  const excessChoice = body?.excess;
  if (excessChoice !== undefined && excessChoice !== "credit" && excessChoice !== "refunded") {
    return NextResponse.json({ error: "excess phải là credit hoặc refunded" }, { status: 400 });
  }

  const row = await prisma.bankTransaction.findUnique({ where: { id } });
  if (!row || row.tutorId !== auth.userId) return NextResponse.json({ error: "Không tìm thấy khoản tiền" }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ error: "Khoản này đã được xử lý" }, { status: 409 });

  // Phiếu mục tiêu: match_invoice dùng phiếu gia sư chọn; còn lại dùng phiếu đã gắn.
  let targetId: string | null = row.invoiceId;
  if (action === "match_invoice") {
    if (typeof body?.invoiceId !== "string") return NextResponse.json({ error: "Thiếu invoiceId" }, { status: 400 });
    targetId = body.invoiceId;
  }
  if (action !== "not_tuition" && !targetId) return NextResponse.json({ error: "Khoản này chưa gắn với phiếu nào" }, { status: 400 });

  try {
    const out = await prisma.$transaction(async db => {
      const claim = (resolution: string) => db.bankTransaction.updateMany({
        where: { id, tutorId: auth.userId, status: "pending" },
        data: { status: resolution === "not_tuition" ? "ignored" : "resolved", resolution, resolvedBy: auth.userId, resolvedAt: new Date() },
      });

      if (action === "not_tuition") {
        if ((await claim("not_tuition")).count === 0) throw new HttpErr(409, "Khoản này đã được xử lý");
        return { applied: 0, excess: 0 };
      }

      const inv0 = await db.tuitionInvoice.findUnique({ where: { id: targetId! }, select: { id: true, tutorId: true } });
      if (!inv0 || inv0.tutorId !== auth.userId) throw new HttpErr(404, "Không tìm thấy phiếu");
      await lockInvoice(db, inv0.id);
      const inv = await db.tuitionInvoice.findUniqueOrThrow({ where: { id: inv0.id } });
      const rem = remainingOf(inv);
      const isOpen = (OPEN_STATUSES as string[]).includes(inv.status) || inv.status === "draft";

      let applied = 0, excess = 0, resolution = "";
      let handling: "credit" | "refunded" | null = null;

      if (action === "apply") {
        if (!isOpen || rem === 0) throw new HttpErr(409, "Phiếu không còn nhận tiền — chọn cách xử lý phần dư");
        if (row.amount > rem) throw new HttpErr(409, "Khoản này lớn hơn phần còn lại của phiếu — chọn trừ vào tháng sau hoặc đã trả lại");
        applied = row.amount; resolution = "applied_partial";
      } else if (action === "credit_next_month" || action === "refunded") {
        applied = isOpen ? Math.min(row.amount, rem) : 0;
        excess = row.amount - applied;
        if (excess === 0) throw new HttpErr(409, "Không có phần dư — dùng 'Ghi nhận' để cộng vào phiếu");
        handling = action === "credit_next_month" ? "credit" : "refunded";
        resolution = action;
      } else { // match_invoice
        if (!isOpen || rem === 0) throw new HttpErr(409, "Phiếu đã chọn không còn nhận tiền");
        applied = Math.min(row.amount, rem);
        excess = row.amount - applied;
        if (excess > 0) {
          if (!excessChoice) throw new HttpErr(400, `Khoản này dư ${excess.toLocaleString("vi-VN")}đ so với phần còn lại — chọn trừ vào tháng sau hoặc đã trả lại`, { needExcess: true, excess });
          handling = excessChoice as "credit" | "refunded";
        }
        resolution = "matched_manual";
      }

      if ((await claim(resolution)).count === 0) throw new HttpErr(409, "Khoản này đã được xử lý");
      if (applied > 0) await applyToInvoice(db, inv.id, applied);
      if (excess > 0 && handling === "credit") await addCredit(db, auth.userId, inv.studentId, excess, id);
      await db.bankTransaction.update({ where: { id }, data: { appliedAmount: applied, invoiceId: inv.id, matchedCode: row.matchedCode ?? inv.code } });
      return { applied, excess, handling, code: inv.code };
    });
    await logAction(auth.userId, "bank_tx.resolve", "BankTransaction", id, { action: action as string, amount: row.amount, ...out });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof HttpErr) return NextResponse.json({ error: e.msg, ...(e.extra ?? {}) }, { status: e.http });
    console.error("[POST /api/tutor/bank-transactions/resolve]", e);
    return NextResponse.json({ error: "Xử lý thất bại" }, { status: 500 });
  }
}
