import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { parseTutorProfileInput, tutorApplicationStatus } from "@/lib/tutorProfile";
import { prefsLockKey, readPreferences } from "@/lib/userPreferences";
import type { Prisma } from "@/generated/prisma/client";

// GET/PUT /api/users/me/tutor-profile — gia sư xem/sửa hồ sơ của mình (BE-049).
// Được dùng: gia sư đã duyệt (adminRole "teacher") hoặc người đang có đơn
// (tutorAppliedAt != null, kể cả đơn bị từ chối — để sửa hồ sơ trước khi
// nộp lại). Người khác → 403.
//
// ĐX-06: ngoài giới thiệu và môn dạy còn có `city` (Tỉnh/Thành, cột users.city) và `teaching` (quận/huyện, hình thức, trường + bằng cấp,
// giá tham khảo; User.preferences.teaching). Thiếu khoá → giữ nguyên; `teaching: null` → xoá cả mục. Mọi thứ TỰ KHAI, kiểm ở tutorArea.ts.

const SELECT = {
  bio: true, subjects: true, adminRole: true,
  tutorAppliedAt: true, tutorVerified: true, tutorVerifiedAt: true,
  tutorRejectedAt: true, tutorRejectReason: true, city: true, preferences: true,
} as const;

function toDTO(u: {
  adminRole: string | null; bio: string | null; subjects: string[]; tutorAppliedAt: Date | null; tutorVerified: boolean;
  tutorVerifiedAt: Date | null; tutorRejectedAt: Date | null; tutorRejectReason: string | null; city: string | null; preferences: unknown;
}) {
  return {
    bio:              u.bio,
    subjects:         u.subjects,
    // Gia sư tạo trước 1.4.4 (nút "Thêm Giáo viên") không có đơn nhưng đã là teacher.
    status:           u.adminRole === "teacher" ? "approved" : tutorApplicationStatus(u),
    tutorVerified:    u.tutorVerified,
    tutorVerifiedAt:  u.tutorVerifiedAt,
    rejectReason:     u.tutorRejectedAt ? u.tutorRejectReason : null,
    // ĐX-06: của CHÍNH gia sư (không phải bản công khai): trả lại đúng thứ đã lưu để form điền sẵn.
    city:             u.city,
    teaching:         readPreferences(u.preferences).teaching ?? null,
  };
}

async function loadAllowed(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: SELECT });
  if (!u) return null;
  if (u.adminRole !== "teacher" && !u.tutorAppliedAt) return null;
  return u;
}

export async function GET() {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const u = await loadAllowed(auth.userId);
  if (!u) return NextResponse.json({ error: "Chỉ gia sư mới có hồ sơ gia sư" }, { status: 403 });
  return NextResponse.json(toDTO(u));
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const u = await loadAllowed(auth.userId);
  if (!u) return NextResponse.json({ error: "Chỉ gia sư mới có hồ sơ gia sư" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const parsed = parseTutorProfileInput(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.subjects !== undefined && parsed.subjects.length === 0) {
    return NextResponse.json({ error: "Chọn ít nhất 1 môn dạy" }, { status: 400 });
  }

  const data: { bio?: string | null; subjects?: string[]; city?: string | null; preferences?: Prisma.InputJsonValue } = {};
  if (parsed.bio !== undefined) data.bio = parsed.bio;
  if (parsed.subjects !== undefined) data.subjects = parsed.subjects;
  if (parsed.city !== undefined) data.city = parsed.city;

  // `teaching` nằm trong User.preferences: đọc-sửa-ghi một cột JSON nên dùng CÙNG khoá giao dịch với /api/users/me/preferences,
  // để đổi chủ đề/module ở tab khác không ghi đè lên khu vực vừa lưu (và ngược lại).
  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.teaching !== undefined) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefsLockKey(auth.userId)}))`;
      const cur = await tx.user.findUnique({ where: { id: auth.userId }, select: { preferences: true } });
      const prefs = readPreferences(cur?.preferences);
      if (parsed.teaching === null) delete prefs.teaching; else prefs.teaching = parsed.teaching;
      data.preferences = prefs as Prisma.InputJsonValue;
    }
    return tx.user.update({ where: { id: auth.userId }, data, select: SELECT });
  });
  return NextResponse.json(toDTO(updated));
}
