// KiN Pro — nhắc gia hạn T-7 / T-3 / T-0: quy tắc THUẦN (không Prisma, không đồng hồ ngầm). Phần chạy thật ở src/lib/proRenewalServer.ts.
// Nguyên tắc: nhắc trong ứng dụng (thông báo), KHÔNG đẩy ra điện thoại (loại "pro_renewal" không nằm trong PUSH_TYPES), KHÔNG tự trừ tiền,
// chữ KHÔNG có tên người và KHÔNG có số tiền. Chỉ nói đúng điều đã xảy ra: tạo thông báo trong app, không hứa email / tin nhắn.
import { proStateOf, type ProPeriodLike } from "@/lib/planLimits";
import { vnDateKeyOf } from "@/lib/classSessions";

export const RENEWAL_MILESTONES = [7, 3, 0] as const;
export type RenewalMilestone = (typeof RENEWAL_MILESTONES)[number];
const DAY_MS = 86_400_000;

/** Số NGÀY LỊCH (giờ VN) từ hôm nay tới ngày hết hạn. 0 = hết hạn trong hôm nay; âm = đã qua ngày hết hạn. */
export function daysLeftVn(end: Date, now: Date): number {
  return Math.round((Date.parse(`${vnDateKeyOf(end)}T00:00:00Z`) - Date.parse(`${vnDateKeyOf(now)}T00:00:00Z`)) / DAY_MS);
}

/**
 * Mốc đang áp dụng. Cron chạy mỗi ngày nhưng có thể trễ / lỡ một hôm, nên dùng CỬA SỔ chứ không đòi đúng ngày:
 * ≤0 → T-0 · 1–3 → T-3 · 4–7 → T-7 · >7 hoặc đã quá hạn → không nhắc. Mỗi lần chỉ MỘT mốc (mốc gần hạn nhất), nên không dồn nhiều tin một ngày.
 */
export function renewalMilestone(daysLeft: number): RenewalMilestone | null {
  if (!Number.isFinite(daysLeft) || daysLeft < 0 || daysLeft > 7) return null;
  return daysLeft === 0 ? 0 : daysLeft <= 3 ? 3 : 7;
}

const dmy = (d: Date) => { const k = vnDateKeyOf(d); return `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`; };

/** Chữ thông báo. Có NGÀY hết hạn và số ngày còn lại (không phải số tiền, không phải tên). Không nói "đã gửi email" hay hứa gì ngoài việc gia hạn là do bạn chọn. */
export function renewalText(milestone: RenewalMilestone, daysLeft: number, end: Date): { title: string; message: string } {
  const when = milestone === 0 ? "hết hạn trong hôm nay" : `còn ${daysLeft} ngày, hết hạn ngày ${dmy(end)}`;
  return {
    title: milestone === 0 ? "Gói KiN Pro hết hạn hôm nay" : "Gói KiN Pro sắp hết hạn",
    message: `Gói KiN Pro của bạn ${when}. Gia hạn bằng QR chuyển khoản ở mục Gói của tôi; hạn mới được cộng dồn vào hạn đang có. KiN không tự trừ tiền. Dữ liệu và sổ lớp của bạn vẫn giữ nguyên.`,
  };
}

export interface RenewalCandidate { userId: string; cycleEnd: Date; milestone: RenewalMilestone; daysLeft: number }
/** Từ các kỳ Pro của từng gia sư → ai cần nhắc mốc nào. `cycleEnd` = hạn Pro hiện tại (cuối chuỗi kỳ nối liền): đổi khi gia hạn → chu kỳ mới. */
export function planRenewals(users: { userId: string; orders: ProPeriodLike[] }[], now: Date): RenewalCandidate[] {
  const out: RenewalCandidate[] = [];
  for (const u of users) {
    const st = proStateOf(u.orders, now);
    if (!st.isPro || !st.proUntil) continue;
    const daysLeft = daysLeftVn(st.proUntil, now), milestone = renewalMilestone(daysLeft);
    if (milestone !== null) out.push({ userId: u.userId, cycleEnd: st.proUntil, milestone, daysLeft });
  }
  return out;
}
