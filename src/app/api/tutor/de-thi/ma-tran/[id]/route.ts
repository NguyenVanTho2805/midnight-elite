// BU-03 P2 — một ma trận đề: GET · PUT { name, rows } · DELETE. Không có → 404; của người khác → 403. Xoá ma trận KHÔNG xoá đề đã tạo từ nó (SetNull).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, loadOwnedBlueprint, saveBlueprint, shapeBlueprint } from "@/lib/deThiServer";

type P = { params: Promise<{ id: string }> };
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedBlueprint(auth.userId, id);
    if (!got.ok) return failResponse(got);
    return NextResponse.json(shapeBlueprint(got.bp), { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/ma-tran/[id]]", e);
    return NextResponse.json({ error: "Chưa tải được ma trận. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedBlueprint(auth.userId, id);
    if (!got.ok) return failResponse(got);
    const body = await req.json().catch(() => null) as { name?: unknown; rows?: unknown } | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
    const out = await saveBlueprint(auth.userId, body, id);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ id: out.id });
  } catch (e) {
    console.error("[PUT /api/tutor/de-thi/ma-tran/[id]]", e);
    return NextResponse.json({ error: "Chưa lưu được ma trận. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const got = await loadOwnedBlueprint(auth.userId, id);
    if (!got.ok) return failResponse(got);
    await prisma.examBlueprint.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/tutor/de-thi/ma-tran/[id]]", e);
    return NextResponse.json({ error: "Chưa xoá được ma trận. Thử lại sau ít phút." }, { status: 500 });
  }
}
