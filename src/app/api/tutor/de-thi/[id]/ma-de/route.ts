// BU-03 P2 — mã đề của MỘT đề gốc. GET → { variants[{id,variantNo,code,questionCount,warnings}], warnings[], hasVariants, studentSupport }.
// POST { count 2..8 (tổng số mã gồm đề gốc), shuffleQuestions, shuffleOptions, fixed[] (vị trí câu cố định, đánh số từ 1) } → tạo / TẠO LẠI mã đề con
// (xoá con cũ rồi dựng mới trong một giao dịch). Chỉ khi đề gốc còn nháp (409 NOT_DRAFT). Id là mã đề con → 400 IS_VARIANT.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, getVariants, makeVariants } from "@/lib/deThiServer";

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const out = await getVariants(auth.userId, id);
    if (!out.ok) return failResponse(out);
    const { ok: _ok, ...rest } = out; void _ok;
    return NextResponse.json(rest, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/[id]/ma-de]", e);
    return NextResponse.json({ error: "Chưa tải được mã đề. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
    const out = await makeVariants(auth.userId, id, body);
    if (!out.ok) return failResponse(out);
    const { ok: _ok, ...rest } = out; void _ok;
    return NextResponse.json(rest, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/[id]/ma-de]", e);
    return NextResponse.json({ error: "Chưa tạo được mã đề. Thử lại sau ít phút." }, { status: 500 });
  }
}
