// POST { phone } (không cần đăng nhập) → mã học viên + tên che bớt của tài khoản học sinh có số điện thoại ĐÃ XÁC MINH bằng mã SMS.
// Trước đây khớp cả `phone` lẫn `parentPhone` (hai ô tự khai, không ai xác minh) rồi trả tên đầy đủ + danh sách lớp cho bất kỳ ai gõ số:
// biết số của ai là xem được họ học lớp nào. Giờ: chỉ khớp `phoneE164` (mỗi số gắn với MỘT tài khoản, đã nhận mã SMS), không trả lớp,
// không trả tên đầy đủ, và giới hạn theo cả số điện thoại chứ không chỉ theo IP. SMS tắt thì chưa có số nào được xác minh → 503 như các route số điện thoại khác.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { normalizeVnPhone } from "@/lib/phone";
import { smsEnabled } from "@/lib/sms";
import { maskName } from "@/lib/traCuu";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked = limitOrBlock(ip, "tra-cuu", 10, 60_000);
  if (blocked) return blocked;

  try {
    if (!smsEnabled()) return NextResponse.json({ error: "Tra cứu theo số điện thoại chưa mở.", code: "sms-off" }, { status: 503 });

    const body = await req.json().catch(() => null);
    const e164 = normalizeVnPhone(body?.phone);
    if (!e164) return NextResponse.json({ error: "Số điện thoại không hợp lệ" }, { status: 400 });

    // Đổi IP không giúp dò một số: mỗi SỐ chỉ được hỏi 5 lần / 10 phút (cùng mức với xin mã SMS). `limitOrBlock` chỉ ghép khoá "route:giá trị".
    const tooMany = limitOrBlock(e164, "tra-cuu-phone", 5, 10 * 60_000);
    if (tooMany) return tooMany;

    const user = await prisma.user.findUnique({
      where: { phoneE164: e164 },
      select: { name: true, studentId: true, role: true, phoneVerifiedAt: true },
    });
    if (!user || user.role !== "student" || !user.phoneVerifiedAt) {
      return NextResponse.json({ error: "Không tìm thấy học viên nào có số điện thoại đã xác minh này" }, { status: 404 });
    }

    return NextResponse.json({ results: [{ maskedName: maskName(user.name), studentId: user.studentId }] });
  } catch (e) {
    console.error("[tra-cuu]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
