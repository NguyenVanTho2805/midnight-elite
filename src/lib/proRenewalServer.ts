// KiN Pro — chạy nhắc gia hạn (cron hằng ngày). Quy tắc thuần ở src/lib/proRenewal.ts.
// - Chỉ nhắc khi gia hạn THẬT SỰ làm được: bán gói đang mở (đã cấu hình nhận tiền, không phải bản xem trước / chạy thử). Nếu không thì không nhắc
//   (nhắc "hãy gia hạn" mà màn Gói ghi "Chưa mở bán" là đường chết).
// - Chỉ nhắc CHỦ gói (người có kỳ Pro đang hiệu lực), gia sư chưa bị khoá.
// - Mỗi (gia sư, hạn chu kỳ, mốc) tối đa một lần: dòng ProRenewalReminder và thông báo tạo CÙNG MỘT giao dịch → đếm "đã nhắc" = số thông báo thật sự được tạo.
import { prisma } from "@/lib/prisma";
import { isPreviewEnv } from "@/lib/planLimits";
import { proPayConfig } from "@/lib/proPayment";
import { planRenewals, renewalText } from "@/lib/proRenewal";

export interface RenewalRunResult { skipped: "preview" | "sale-closed" | null; candidates: number; created: number; alreadySent: number; failed: number }

export async function runProRenewalReminders(now: Date = new Date()): Promise<RenewalRunResult> {
  const none = { candidates: 0, created: 0, alreadySent: 0, failed: 0 };
  if (isPreviewEnv()) return { skipped: "preview", ...none };
  if (!proPayConfig().open) return { skipped: "sale-closed", ...none };

  const horizon = new Date(now.getTime() + 9 * 86_400_000);
  const near = await prisma.proOrder.findMany({
    where: { status: "active", endDate: { gt: now, lte: horizon }, user: { role: "admin", adminRole: "teacher", banned: false } },
    select: { userId: true }, distinct: ["userId"],
  });
  const ids = near.map(n => n.userId);
  const orders = ids.length ? await prisma.proOrder.findMany({ where: { userId: { in: ids }, status: "active" }, select: { userId: true, status: true, startDate: true, endDate: true } }) : [];
  const byUser = new Map<string, typeof orders>();
  for (const o of orders) byUser.set(o.userId, [...(byUser.get(o.userId) ?? []), o]);
  const cands = planRenewals([...byUser].map(([userId, os]) => ({ userId, orders: os })), now);

  let created = 0, alreadySent = 0, failed = 0;
  for (const c of cands) {
    const text = renewalText(c.milestone, c.daysLeft, c.cycleEnd);
    try {
      const made = await prisma.$transaction(async (tx) => {
        if (await tx.proRenewalReminder.findUnique({ where: { userId_cycleEnd_milestone: { userId: c.userId, cycleEnd: c.cycleEnd, milestone: c.milestone } }, select: { id: true } })) return false;
        await tx.proRenewalReminder.create({ data: { userId: c.userId, cycleEnd: c.cycleEnd, milestone: c.milestone } });
        await tx.notification.create({ data: { userId: c.userId, type: "pro_renewal", title: text.title, message: text.message, link: "/lop-cua-toi/goi" } });
        return true;
      });
      if (made) created++; else alreadySent++;
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") alreadySent++; // hai lần chạy chồng nhau: lần kia đã nhắc
      else { failed++; console.error("[pro-renewal] không tạo được nhắc:", e); }
    }
  }
  return { skipped: null, candidates: cands.length, created, alreadySent, failed };
}
