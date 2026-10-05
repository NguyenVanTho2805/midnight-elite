import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { InsufficientBalanceError } from "@/lib/wallet";
import { COIN_REASONS, COIN_SOURCE_TYPES } from "@/lib/wallet-constants";
import {
  getTutorVIPPlan,
  getActiveTutorSubscription,
  computeNewEndDate,
} from "@/lib/tutorSubscription";

// POST /api/subscriptions/[code]/purchase — gia sư mua VIP. Chỉ adminRole
// = "teacher" mua được (admin_super/admin_content vận hành platform, không
// cần VIP; student không áp dụng).
//
// Toàn bộ chạy trong 1 prisma.$transaction để nguyên tử:
// (1) Trừ Coin trong wallet (atomic bằng decrement + guard balance),
// (2) Ghi CoinTransaction với reason/sourceType/refId trỏ về TutorSubscription,
// (3) Hoặc tạo mới TutorSubscription (gia sư chưa VIP),
//     Hoặc cộng dồn endDate vào bản ghi active hiện có (mua chồng).
// Nếu bước (1) không đủ xu → ném InsufficientBalanceError, không chạm (2)(3).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin" || auth.adminRole !== "teacher") {
    return NextResponse.json({ error: "Chỉ gia sư mới cần gói VIP" }, { status: 403 });
  }

  const { code } = await params;
  const plan = getTutorVIPPlan(code);
  if (!plan) {
    return NextResponse.json({ error: "Gói không tồn tại" }, { status: 404 });
  }

  const currentActive = await getActiveTutorSubscription(auth.userId);

  try {
    const subscription = await prisma.$transaction(async (tx) => {
      // Trừ Coin — guard balance >= price qua updateMany với where balance
      // GTE price. count=0 nghĩa là không đủ xu → throw để rollback.
      const spent = await tx.wallet.updateMany({
        where: { userId: auth.userId, balance: { gte: plan.priceCoin } },
        data:  { balance: { decrement: plan.priceCoin } },
      });
      if (spent.count === 0) throw new InsufficientBalanceError();

      let sub;
      if (currentActive) {
        // Mua chồng: cộng dồn thời hạn vào bản ghi active hiện có.
        sub = await tx.tutorSubscription.update({
          where: { id: currentActive.id },
          data:  {
            endDate:       computeNewEndDate(currentActive.endDate, plan.durationDays),
            priceCoinPaid: currentActive.priceCoinPaid + plan.priceCoin,
          },
        });
      } else {
        // Tạo bản ghi mới.
        const now = new Date();
        sub = await tx.tutorSubscription.create({
          data: {
            userId:        auth.userId,
            planCode:      plan.code,
            priceCoinPaid: plan.priceCoin,
            durationDays:  plan.durationDays,
            startDate:     now,
            endDate:       computeNewEndDate(null, plan.durationDays),
            status:        "active",
          },
        });
      }

      await tx.coinTransaction.create({
        data: {
          userId:     auth.userId,
          amount:     -plan.priceCoin,
          reason:     COIN_REASONS.TUTOR_VIP_PURCHASE,
          refId:      sub.id,
          sourceType: COIN_SOURCE_TYPES.TUTOR_SUBSCRIPTION,
          classId:    null, // VIP của gia sư, không gắn lớp
        },
      });

      return sub;
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (e) {
    if (e instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: "Số dư xu không đủ để mua gói này" }, { status: 400 });
    }
    console.error("[POST /api/subscriptions/[code]/purchase]", code, e);
    return NextResponse.json({ error: "Mua gói thất bại" }, { status: 500 });
  }
}
