// ĐX-02 — cửa vào của các API thông báo đẩy: CHỈ gia sư (role admin + adminRole "teacher"). Học viên, phụ huynh, quản trị cấp 1 / cấp nội dung → 403.
// Phụ huynh không có tài khoản nên không có đẩy; Zalo vẫn là kênh của họ.
import { NextResponse } from "next/server";
import { isNextResponse, requireSession } from "@/lib/auth-guard";
import type { SessionPayload } from "@/lib/session";

export async function requirePushTutor(): Promise<SessionPayload | NextResponse> {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  if (auth.role !== "admin" || auth.adminRole !== "teacher") {
    return NextResponse.json({ error: "Chỉ gia sư mới bật được thông báo đẩy" }, { status: 403 });
  }
  return auth;
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;
