import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { parseTutorProfileInput, tutorApplicationStatus } from "@/lib/tutorProfile";

// GET/PUT /api/users/me/tutor-profile — gia sư xem/sửa hồ sơ của mình (BE-049).
// Được dùng: gia sư đã duyệt (adminRole "teacher") hoặc người đang có đơn
// (tutorAppliedAt != null, kể cả đơn bị từ chối — để sửa hồ sơ trước khi
// nộp lại). Người khác → 403.

const SELECT = {
  bio: true, subjects: true, adminRole: true,
  tutorAppliedAt: true, tutorVerified: true, tutorVerifiedAt: true,
  tutorRejectedAt: true, tutorRejectReason: true,
} as const;

function toDTO(u: {
  adminRole: string | null; bio: string | null; subjects: string[]; tutorAppliedAt: Date | null; tutorVerified: boolean;
  tutorVerifiedAt: Date | null; tutorRejectedAt: Date | null; tutorRejectReason: string | null;
}) {
  return {
    bio:              u.bio,
    subjects:         u.subjects,
    // Gia sư tạo trước 1.4.4 (nút "Thêm Giáo viên") không có đơn nhưng đã là teacher.
    status:           u.adminRole === "teacher" ? "approved" : tutorApplicationStatus(u),
    tutorVerified:    u.tutorVerified,
    tutorVerifiedAt:  u.tutorVerifiedAt,
    rejectReason:     u.tutorRejectedAt ? u.tutorRejectReason : null,
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

  const data: { bio?: string | null; subjects?: string[] } = {};
  if (parsed.bio !== undefined) data.bio = parsed.bio;
  if (parsed.subjects !== undefined) data.subjects = parsed.subjects;

  const updated = await prisma.user.update({ where: { id: auth.userId }, data, select: SELECT });
  return NextResponse.json(toDTO(updated));
}
