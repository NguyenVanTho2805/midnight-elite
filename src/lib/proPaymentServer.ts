// KiN Pro — xử lý một khoản tiền SePay báo về cho gói Pro (có I/O). Quy tắc quyết định thuần ở src/lib/proPayment.ts (decideProPayment).
// Toàn bộ trong MỘT giao dịch DB: dòng ProPayment (duy nhất theo (provider, providerTxId)) + quyết định + kích hoạt. Hoặc có tất cả, hoặc không có gì,
// nên gọi lại cùng giao dịch (SePay gửi lại khi mình trả lỗi / chậm) không bao giờ kích hoạt hai lần, và không để lại trạng thái nửa chừng.
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";
import { notify } from "@/lib/notify";
import { applyProActivation, proLock } from "@/lib/planServer";
import { decideProPayment, extractProCode, type ProReviewReason } from "@/lib/proPayment";
import { isPreviewEnv } from "@/lib/planLimits";

export interface IncomingProTx { id: string; amount: number; occurredAt: Date; content: string; code: string | null }
export type SettleOutcome =
  | { outcome: "duplicate" }
  | { outcome: "activated"; userId: string; orderId: string }
  | { outcome: "review"; reason: ProReviewReason };

export async function settleProPayment(tx: IncomingProTx, prefix: string, now: Date = new Date()): Promise<SettleOutcome> {
  if (isPreviewEnv()) throw new Error("Bản xem trước không xử lý thanh toán Pro");
  const where = { provider_providerTxId: { provider: "sepay", providerTxId: tx.id } };
  if (await prisma.proPayment.findUnique({ where, select: { id: true } })) return { outcome: "duplicate" };
  const code = extractProCode(prefix, tx.code, tx.content);
  try {
    const out = await prisma.$transaction(async (db) => {
      // Dòng ghi nhận đi TRƯỚC: hai lần gọi đồng thời cùng giao dịch → lần sau chờ lần trước xong rồi vấp khoá duy nhất (P2002) và rút lui.
      const row = await db.proPayment.create({
        data: { provider: "sepay", providerTxId: tx.id, amount: tx.amount, content: tx.content.slice(0, 500), occurredAt: tx.occurredAt, matchedCode: code, status: "review", reason: "no_code" },
      });
      let order = code ? await db.proOrder.findUnique({ where: { memoCode: code } }) : null;
      if (order) {
        await proLock(db, order.userId); // cùng khoá với admin bấm kích hoạt tay → không cộng đôi giữa hai đường
        order = await db.proOrder.findUnique({ where: { id: order.id } });
      }
      const d = decideProPayment({ code, order, amount: tx.amount });
      if (d.action === "activate" && order) {
        await applyProActivation(db, order, null, tx.id, now);
        await db.proPayment.update({ where: { id: row.id }, data: { status: "activated", reason: null, orderId: order.id } });
        return { outcome: "activated" as const, userId: order.userId, orderId: order.id };
      }
      const reason = d.action === "review" ? d.reason : "no_code";
      await db.proPayment.update({ where: { id: row.id }, data: { status: "review", reason, orderId: order?.id ?? null } });
      return { outcome: "review" as const, reason };
    });
    if (out.outcome === "activated") {
      await logAction(null, "pro_order.activate_sepay", "ProOrder", out.orderId, { userId: out.userId, providerTxId: tx.id });
      // Chữ dựng cố định: không tên người, không số tiền.
      await notify(out.userId, { type: "pro_activated", title: "Gói KiN Pro đã được kích hoạt", message: "KiN đã nhận khoản chuyển của bạn và cộng thêm hạn cho gói Pro. Xem hạn mới ở mục Gói của tôi.", link: "/lop-cua-toi/goi" });
    }
    return out;
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { outcome: "duplicate" }; // trùng đồng thời
    throw e;
  }
}
