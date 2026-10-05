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
  return Object.prototype.hasOwnProperty.call(TUTOR_VIP_PLANS, code)
    ? TUTOR_VIP_PLANS[code as TutorVIPPlanCode]
    : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Gói VIP còn hạn có endDate xa nhất — dùng để hiển thị "VIP tới ngày X".
// Mua chồng tạo bản ghi nối tiếp (startDate = endDate gói trước), nên bản
// ghi trả về có thể có startDate ở tương lai; endDate của nó là mốc hết VIP
// thật. Null = chưa VIP / đã hết hạn.
export async function getActiveTutorSubscription(userId: string) {
  return prisma.tutorSubscription.findFirst({
    where:   { userId, status: "active", endDate: { gt: new Date() } },
    orderBy: { endDate: "desc" },
  });
}

export async function isActiveTutorVIP(userId: string): Promise<boolean> {
  const now = new Date();
  const hit = await prisma.tutorSubscription.findFirst({
    where:  { userId, status: "active", startDate: { lte: now }, endDate: { gt: now } },
    select: { id: true },
  });
  return !!hit;
}

// Gói mới bắt đầu ngay nếu chưa VIP; nếu đang VIP thì nối tiếp ngay sau
// ngày hết hạn gói hiện tại — không mất ngày đã trả.
export function nextPeriod(latestEndDate: Date | null, durationDays: number, now = new Date()) {
  const startDate = latestEndDate && latestEndDate > now ? latestEndDate : now;
  return { startDate, endDate: new Date(startDate.getTime() + durationDays * DAY_MS) };
}
