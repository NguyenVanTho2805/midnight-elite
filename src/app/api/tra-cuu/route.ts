import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";
import { buildLookupResult, cleanLookupPhone, LOOKUP_LIMITS } from "@/lib/lookupPrivacy";

// POST /api/tra-cuu { phone } — công khai (khách gọi được), nên chỉ trả đúng mức cần (NC2-053, quy tắc ở src/lib/lookupPrivacy.ts):
//  · chỉ khớp SĐT học sinh tự đăng ký (không còn khớp SĐT phụ huynh tự khai);
//  · người lạ: tên đã che + số khoá; chỉ CHÍNH học sinh (phiên đăng nhập trùng) mới thấy mã học viên và danh sách khoá;
//  · giới hạn theo IP (phút + ngày) VÀ theo từng số điện thoại (băm, không giữ số thật trong bộ nhớ).
// Lưu ý: bộ đếm nằm trong bộ nhớ từng máy chủ (src/lib/rate-limit.ts) nên trên Vercel mỗi instance đếm riêng — chặn được người dò thường, không chặn được kẻ dùng nhiều IP;
// muốn chặn thật cần bộ đếm dùng chung (cơ sở dữ liệu / Redis), là việc riêng.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const blocked =
    limitOrBlock(ip, "tra-cuu", LOOKUP_LIMITS.ipPerMinute, 60_000) ??
    limitOrBlock(ip, "tra-cuu-ngay", LOOKUP_LIMITS.ipPerDay, 24 * 60 * 60_000);
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => null);
    const phone = cleanLookupPhone(body && typeof body === "object" ? (body as { phone?: unknown }).phone : null);
    if (!phone) return NextResponse.json({ error: "Số điện thoại không hợp lệ" }, { status: 400 });

    const phoneKey = createHash("sha256").update(phone).digest("hex");
    const blockedPhone = limitOrBlock(phoneKey, "tra-cuu-sdt", LOOKUP_LIMITS.phonePerWindow, LOOKUP_LIMITS.phoneWindowMs);
    if (blockedPhone) return blockedPhone;

    const users = await prisma.user.findMany({
      where: { role: "student", phone },
      select: {
        id:        true,
        name:      true,
        studentId: true,
        enrollments: {
          // Chỉ khoá ĐANG HỌC: ghi danh "pending_consent" (chờ phụ huynh xác nhận, học viên dưới ngưỡng tuổi) và "suspended" không lộ ra tra cứu công khai.
          where: { status: "active" },
          select: {
            course: {
              select: { id: true, name: true, shortTitle: true, category: true, status: true },
            },
          },
        },
      },
    });

    if (users.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy học viên đăng ký bằng số điện thoại này" }, { status: 404 });
    }

    // getSession đọc cookie của yêu cầu; lỗi (không có phiên, cấu hình thiếu) = coi như khách, KHÔNG làm hỏng việc tra cứu.
    const session = await getSession().catch(() => null);
    const results = users.map(u => buildLookupResult({
      name: u.name,
      studentId: u.studentId,
      courses: u.enrollments.map(e => ({
        id:         e.course.id,
        name:       e.course.name,
        shortTitle: e.course.shortTitle,
        category:   e.course.category,
        status:     e.course.status,
      })),
    }, session?.role === "student" && session.userId === u.id));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[tra-cuu]", e);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
