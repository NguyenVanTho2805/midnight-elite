// BU-03 P3 — Giao đề. GET → cấu hình hiện tại (không hash, không mật khẩu). PATCH → tập con các khoá (validateAssignPatch; mật khẩu băm; maxAttempts ghi/xoá QuizAttemptLimit).
// POST { action: "close" | "reopen" } → đóng / mở lại cả nhóm mã đề, ghi ExamChangeLog. Gác requireTutor (Q1); id mã đề con → 400 IS_VARIANT.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse } from "@/lib/deThiServer";
import { getAssign, patchAssign, setAssignActive } from "@/lib/deThiAssignServer";

type P = { params: Promise<{ id: string }> };
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const out = await getAssign(auth.userId, id);
    if (!out.ok) return failResponse(out);
    return NextResponse.json(out.view, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/[id]/giao]", e);
    return NextResponse.json({ error: "Chưa tải được cài đặt giao đề. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const out = await patchAssign(auth.userId, id, body);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ ...out.view, warnings: out.warnings }, { headers: NO_STORE });
  } catch (e) {
    console.error("[PATCH /api/tutor/de-thi/[id]/giao]", e);
    return NextResponse.json({ error: "Chưa lưu được cài đặt. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null) as { action?: unknown } | null;
    const out = await setAssignActive(auth.userId, id, body && typeof body === "object" ? body.action : undefined);
    if (!out.ok) return failResponse(out);
    return NextResponse.json(out.view, { headers: NO_STORE });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/[id]/giao]", e);
    return NextResponse.json({ error: "Chưa đổi được trạng thái bài. Thử lại sau ít phút." }, { status: 500 });
  }
}
