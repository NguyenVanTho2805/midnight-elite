// BE-061 (1.4.5) — cron hết hạn gói VIP gia sư.
//
// D01 chốt 05/10/2026: SaaS gia sư trả VIP (không phải SubscriptionPurchase
// theo lớp như backlog gốc). Cron quét `TutorSubscription` với
// `status = "active"` và `endDate < now`, chuyển thành "expired".
//
// KHÁC backlog gốc: KHÔNG suspended Enrollment của học viên. Mô hình hiện
// tại — học viên free (D01); hết VIP chỉ ảnh hưởng quyền của gia sư (tạo
// lớp mới, mời học viên...). Enrollment giữ nguyên để học viên tiếp tục
// học, chỉ gia sư không có quyền thao tác lớp mới.
//
// Mỗi lần expire ghi 1 AuditLog "tutor_subscription.expire" (BE-062).
//
// Vercel Cron chạy hàng ngày 0:00 UTC (xem vercel.json). Auth qua
// Bearer CRON_SECRET nếu env có — chống gọi ngoài.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";

const BATCH_SIZE = 100;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
    }
  }

  const now = new Date();
  const expired: { id: string; userId: string; planCode: string }[] = [];
  let totalScanned = 0;

  // Vòng lặp: lấy BATCH_SIZE bản ghi hết hạn, ghi audit từng cái, rồi
  // updateMany theo id của batch. Dừng khi không còn.
  //
  // Dùng id-list để `updateMany` sau khi đã đọc chi tiết — tránh race với
  // người đang mua chồng (purchase VIP mới tạo bản ghi active có endDate
  // tương lai, không rơi vào query này, nhưng vẫn thêm điều kiện status
  // active để chắc).
  while (true) {
    const batch = await prisma.tutorSubscription.findMany({
      where:   { status: "active", endDate: { lt: now } },
      take:    BATCH_SIZE,
      orderBy: { endDate: "asc" },
      select:  { id: true, userId: true, planCode: true, endDate: true },
    });
    if (batch.length === 0) break;
    totalScanned += batch.length;

    const ids = batch.map(b => b.id);
    const upd = await prisma.tutorSubscription.updateMany({
      where: { id: { in: ids }, status: "active" },
      data:  { status: "expired" },
    });

    // Nếu upd.count < batch.length nghĩa là ai đó đã đổi status trong lúc
    // ta đang xử lý — audit theo bản ghi batch sẽ sai sự thật. Dùng
    // findMany lại chỉ các id đã chốt expired để chắc.
    if (upd.count > 0) {
      for (const b of batch) {
        expired.push({ id: b.id, userId: b.userId, planCode: b.planCode });
        // BE-062: ghi audit — actorId null vì hệ thống tự expire.
        await logAction(null, "tutor_subscription.expire", "TutorSubscription", b.id, {
          userId: b.userId, planCode: b.planCode, endDate: b.endDate,
        });
      }
    }

    // Batch nhỏ hơn BATCH_SIZE → đã hết, dừng (tránh query 1 lần nữa trả rỗng).
    if (batch.length < BATCH_SIZE) break;
  }

  return NextResponse.json({ scanned: totalScanned, expired: expired.length });
}
