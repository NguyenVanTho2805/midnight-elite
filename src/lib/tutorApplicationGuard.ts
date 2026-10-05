import { NextResponse } from "next/server";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import type { SessionPayload } from "@/lib/session";

// Duyệt đơn gia sư chỉ dành cho quản lý trung tâm (admin_super,
// admin_content) — teacher có MANAGE_COURSES nhưng không được tự duyệt
// gia sư khác (cùng lý do categories PUT chặn teacher).
export async function requireCenterAdmin(): Promise<SessionPayload | NextResponse> {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin" || (auth.adminRole !== "admin_super" && auth.adminRole !== "admin_content")) {
    return NextResponse.json({ error: "Chỉ quản trị viên trung tâm được duyệt gia sư" }, { status: 403 });
  }
  return auth;
}

// Điều kiện "đơn đang chờ" dùng chung cho list/approve/reject.
export const PENDING_TUTOR_WHERE = {
  tutorAppliedAt:  { not: null },
  tutorVerified:   false,
  tutorRejectedAt: null,
  role:            "student",
  banned:          false,
} as const;
