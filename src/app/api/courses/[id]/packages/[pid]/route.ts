// HP-31 — thao tác trên MỘT gói buổi: huỷ ({ action: "cancel" }). Huỷ chỉ dừng trừ buổi mới; lịch sử trừ buổi giữ nguyên. Không đụng phiếu / dòng phí.
import { NextRequest, NextResponse } from "next/server";
import { logAction } from "@/lib/auditLog";
import { authorizeCourse } from "@/lib/sessionBookServer";
import { cancelPackage } from "@/lib/sessionPackageServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "cancel") return NextResponse.json({ error: "action phải là cancel" }, { status: 400 });
  const res = await cancelPackage(id, pid);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  await logAction(r.auth.userId, "session_package.cancel", "SessionPackage", pid, { courseId: id });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
