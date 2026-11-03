// BU-03 P2 — GET: ma trận đề của tôi · POST { name, rows } → 201 { id }. rows đúng ba khoá { categoryId, difficulty, count }; giới hạn Q5.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse, listBlueprints, saveBlueprint } from "@/lib/deThiServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    return NextResponse.json({ items: await listBlueprints(auth.userId) }, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/ma-tran]", e);
    return NextResponse.json({ error: "Chưa tải được ma trận. Thử lại sau ít phút." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const body = await req.json().catch(() => null) as { name?: unknown; rows?: unknown } | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không đọc được." }, { status: 400 });
    const out = await saveBlueprint(auth.userId, body);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ id: out.id }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tutor/de-thi/ma-tran]", e);
    return NextResponse.json({ error: "Chưa lưu được ma trận. Thử lại sau ít phút." }, { status: 500 });
  }
}
