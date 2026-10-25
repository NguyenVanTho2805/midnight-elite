// NC2-023 — dữ liệu giả cho cờ KIN_TRIAL_MODE. Cờ là biến môi trường nên mock không bật được; mock chỉ dựng hai gia sư để THẤY khác biệt:
//  - giasu@kin.local: CHƯA có gói → khi cờ TẮT thấy form nạp Coin, khi cờ BẬT thấy banner "miễn phí chạy thử".
//  - giasu-vip@kin.local: ĐÃ có gói VIP đang hiệu lực (bản ghi giả, giá 0, KHÔNG có giao dịch Coin, không đụng ví) → cờ bật vẫn còn gói.
import type { MockFn } from "../mock-seed";
import { mkTutor } from "../h";

const DAY = 24 * 60 * 60 * 1000;

const mock: MockFn = async ({ prisma, tutor }) => {
  const email = "giasu-vip@kin.local";
  let vip = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!vip) {
    const t = await mkTutor("Cô Thử Có Gói");
    vip = await prisma.user.update({ where: { id: t.id }, data: { email }, select: { id: true } });
  }
  const has = await prisma.tutorSubscription.count({ where: { userId: vip.id, status: "active", endDate: { gt: new Date() } } });
  if (!has) {
    const now = new Date();
    await prisma.tutorSubscription.create({
      data: { userId: vip.id, planCode: "monthly", priceCoinPaid: 0, durationDays: 30, startDate: new Date(now.getTime() - 5 * DAY), endDate: new Date(now.getTime() + 25 * DAY), status: "active" },
    });
  }
  return [
    `Cờ chạy thử · ${tutor.email} (CHƯA có gói): mở /student/vi → cờ TẮT thấy form "Yêu cầu nạp Coin"; cờ BẬT (thêm KIN_TRIAL_MODE=1 vào .env.local rồi chạy lại bash .local-dev/start.sh) thấy banner "KiN miễn phí trong giai đoạn chạy thử", không có form.`,
    `Cờ chạy thử · ${email} (ĐÃ có gói VIP "monthly" còn ~25 ngày, bản ghi giả giá 0, không giao dịch Coin): GET /api/users/me/subscription vẫn trả gói khi cờ bật, kèm trial:true. POST /api/subscriptions/monthly/purchase → 403 khi cờ bật.`,
  ];
};
export default mock;
