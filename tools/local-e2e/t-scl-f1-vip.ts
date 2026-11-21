// SCL F1 (rà soát) — DB thật, không cần máy chủ: gói VIP gia sư đã qua endDate nhưng status vẫn "active" (cron expire-tutor-subscriptions chưa chạy)
// KHÔNG chặn xoá tài khoản; gói còn hạn vẫn chặn. Chỉ ĐỌC bảng tiền qua countBlockers, dữ liệu thử tự tạo.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-scl-f1-vip.ts
// Ca phá cố ý (đã chạy rồi hoàn lại): bỏ `endDate: { gt: new Date() }` trong countBlockers → ca "hết hạn" đỏ.
import { mkTutor, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { countBlockers, pickBlocker } from "@/lib/accountDelete";

(async () => {
  await wipe();
  const sub = (userId: string, endDate: Date) => prisma.tutorSubscription.create({ data: { userId, planCode: "monthly", priceCoinPaid: 1, durationDays: 30, endDate, status: "active" } });
  section("Gói VIP gia sư và chặn xoá tài khoản");
  const old = await mkTutor("Cô Hết Hạn");
  await sub(old.id, new Date(Date.now() - 86_400_000));
  const c1 = await countBlockers(old.id, "tutor");
  check("gói hết hạn (status còn active): không đếm, không chặn active_subscription", c1.activeSubscriptions === 0 && pickBlocker(c1)?.code !== "active_subscription", c1);
  const live = await mkTutor("Cô Còn Hạn");
  await sub(live.id, new Date(Date.now() + 86_400_000));
  const c2 = await countBlockers(live.id, "tutor");
  check("gói còn hạn: vẫn chặn active_subscription", c2.activeSubscriptions === 1 && pickBlocker(c2)?.code === "active_subscription", c2);
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
