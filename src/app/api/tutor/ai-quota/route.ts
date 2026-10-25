// KiN Pro F5 — GET /api/tutor/ai-quota: số lượt AI trích đề còn lại tháng này, để màn tải đề hiện "còn N lượt". Chỉ đọc, không trừ lượt.
// Cùng quyền với tuyến trích đề (MANAGE_CURRICULUM). Người không phải gia sư (quản trị khác) không bị đếm lượt → { applicable: false }.
import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { getTutorPlan } from "@/lib/planServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  if (auth.adminRole !== "teacher") return NextResponse.json({ applicable: false }, { headers: NO_STORE });
  try {
    const p = await getTutorPlan(auth.userId);
    const q = p.quota.aiExtract;
    return NextResponse.json({ applicable: true, plan: p.code, enforced: p.enforced, used: q.used, limit: q.limit, remaining: q.remaining, state: q.state }, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/ai-quota]", e);
    return NextResponse.json({ error: "Không đọc được số lượt AI, thử lại sau" }, { status: 500, headers: NO_STORE });
  }
}
