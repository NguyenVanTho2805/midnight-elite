// Gói VIP cho gia sư — D01 (chốt 05/10/2026) chọn mô hình SaaS: gia sư trả
// phí để mở full tính năng. 3 gói cố định, giá cố định cho mỗi gói.
//
// Giá hiện tại là PLACEHOLDER (admin sẽ chỉnh qua dashboard sau khi có số
// chính thức). Dùng Coin — 1 Coin = 1 VND trong giai đoạn hiện tại, dễ hình
// dung và không phải tích hợp gateway VND ngay. Khi có gateway, nạp Coin
// bằng VND sau đó mua VIP bằng Coin như hiện tại.

import { prisma } from "@/lib/prisma";

export const TUTOR_VIP_PLANS = {
  monthly:   { code: "monthly",   name: "VIP tháng",    priceCoin:   300_000, durationDays:  30 },
  half_year: { code: "half_year", name: "VIP 6 tháng", priceCoin: 1_500_000, durationDays: 180 },
  yearly:    { code: "yearly",    name: "VIP 1 năm",   priceCoin: 2_500_000, durationDays: 365 },
} as const;

export type TutorVIPPlanCode = keyof typeof TUTOR_VIP_PLANS;

export function getTutorVIPPlan(code: string): (typeof TUTOR_VIP_PLANS)[TutorVIPPlanCode] | null {
  return (code in TUTOR_VIP_PLANS) ? TUTOR_VIP_PLANS[code as TutorVIPPlanCode] : null;
}

// Gia sư đang có VIP còn hạn và status "active". Trả bản ghi mới nhất
// (gia sư có thể mua chồng nhiều lần → lấy cái endDate xa nhất đang active).
// Null = chưa VIP / đã hết hạn.
export async function getActiveTutorSubscription(userId: string) {
  return prisma.tutorSubscription.findFirst({
    where: {
      userId,
      status:  "active",
      endDate: { gt: new Date() },
    },
    orderBy: { endDate: "desc" },
  });
}

export async function isActiveTutorVIP(userId: string): Promise<boolean> {
  return !!(await getActiveTutorSubscription(userId));
}

// Khi gia sư mua VIP lúc đã có VIP đang active: cộng dồn thời hạn vào bản
// ghi hiện tại (ngày hết hạn mới = oldEnd + durationDays). Giữ nguyên bản
// ghi active cũ thay vì tạo mới, để query getActiveTutorSubscription trả 1
// bản ghi liền mạch, dễ hiển thị "đã VIP tới…".
// Khi gia sư chưa VIP (hoặc đã hết hạn): tạo bản ghi mới startDate=now,
// endDate=now+durationDays.
export function computeNewEndDate(oldEndDate: Date | null, durationDays: number): Date {
  const base = oldEndDate && oldEndDate > new Date() ? oldEndDate : new Date();
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
}
