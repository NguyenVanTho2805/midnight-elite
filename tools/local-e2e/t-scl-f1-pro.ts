// SCL F1 (P2-28) — DB thật, không cần máy chủ: nhắc gia hạn KiN Pro KHÔNG tạo chuông khi phần Kinh doanh đang ẩn (cờ KINH_DOANH tắt), vì chuông
// trỏ /lop-cua-toi/goi đang bị chặn 307. Bật cờ thì chạy như cũ. Không đụng tiền: chỉ đếm thông báo, không tạo / sửa đơn Pro ngoài dữ liệu thử.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-scl-f1-pro.ts
// Ca phá cố ý (đã chạy rồi hoàn lại): bỏ dòng `if (!featureOn("KINH_DOANH")) return …` trong runProRenewalReminders → ca "cờ tắt" đỏ.
import { mkTutor, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const FLAG = "NEXT_PUBLIC_KIN_MO_KINH_DOANH";
const DAY = 86_400_000;

(async () => {
  await wipe();
  for (const k of ["VERCEL_ENV", "KINPRO_TRIAL"]) delete process.env[k];
  Object.assign(process.env, { KINPRO_BANK_BIN: "970436", KINPRO_ACCOUNT_NO: "9704360012345", KINPRO_ACCOUNT_NAME: "Kin Pro Thu" }); // bán gói "mở" trong tiến trình bài
  const old = process.env[FLAG];
  const { runProRenewalReminders } = await import("@/lib/proRenewalServer");
  const now = new Date("2027-01-10T00:30:00Z");
  const R = await mkTutor("Cô Nhắc");
  await prisma.proOrder.create({ data: { userId: R.id, period: "month", durationDays: 30, listPriceVnd: 79_000, priceVnd: 79_000, source: "purchase", memoCode: "F1PRO1", status: "active", startDate: new Date(now.getTime() - 23 * DAY), endDate: new Date(now.getTime() + 7 * DAY) } });
  const bells = () => prisma.notification.count({ where: { userId: R.id, type: "pro_renewal" } });

  section("Chuông Pro theo cờ KINH_DOANH");
  delete process.env[FLAG];
  const off = await runProRenewalReminders(now);
  check("cờ tắt: skipped=feature-off, không tạo chuông nào", off.skipped === "feature-off" && off.created === 0 && (await bells()) === 0, off);
  process.env[FLAG] = "1";
  const on = await runProRenewalReminders(now);
  check("cờ mở: nhắc T-7 như cũ (1 chuông, trỏ /lop-cua-toi/goi)", on.skipped === null && on.created === 1 && (await bells()) === 1, on);
  if (old === undefined) delete process.env[FLAG]; else process.env[FLAG] = old;

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
