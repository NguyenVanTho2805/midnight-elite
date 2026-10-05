import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { InsufficientBalanceError } from "@/lib/wallet";
import { COIN_REASONS, COIN_SOURCE_TYPES } from "@/lib/wallet-constants";
import { getTutorVIPPlan, nextPeriod } from "@/lib/tutorSubscription";

// POST /api/subscriptions/[code]/purchase — gia sư mua VIP. Chỉ adminRole
// = "teacher" mua được (admin_super/admin_content vận hành platform, không
// cần VIP; student không áp dụng).
//
// Toàn bộ trong 1 prisma.$transaction, khoá theo userId bằng
// pg_advisory_xact_lock (cùng pattern addDailyCappedCoins) để 2 lần mua
// đồng thời xếp hàng — lần sau đọc được gói lần trước vừa tạo và nối tiếp
// đúng, không chồng lên cùng khoảng thời gian:
// (1) Trừ Coin (updateMany với guard balance >= price; không đủ → throw,
//     rollback, chưa tạo gì),
// (2) Tạo bản ghi TutorSubscription MỚI — mỗi lần mua 1 bản ghi để giữ
//     lịch sử đúng gói/giá; mua chồng thì startDate = endDate gói xa nhất,
// (3) Ghi CoinTransaction với refId = TutorSubscription.id.
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

  try {
    const subscription = await prisma.$transaction(async (tx) => {
      const lockKey = `tutor_vip:${auth.userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const spent = await tx.wallet.updateMany({
        where: { userId: auth.userId, balance: { gte: plan.priceCoin } },
        data:  { balance: { decrement: plan.priceCoin } },
      });
      if (spent.count === 0) throw new InsufficientBalanceError();

      const latest = await tx.tutorSubscription.findFirst({
        where:   { userId: auth.userId, status: "active", endDate: { gt: new Date() } },
        orderBy: { endDate: "desc" },
        select:  { endDate: true },
      });
      const { startDate, endDate } = nextPeriod(latest?.endDate ?? null, plan.durationDays);

      const sub = await tx.tutorSubscription.create({
        data: {
          userId:        auth.userId,
          planCode:      plan.code,
          priceCoinPaid: plan.priceCoin,
          durationDays:  plan.durationDays,
          startDate,
          endDate,
          status:        "active",
        },
      });

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
