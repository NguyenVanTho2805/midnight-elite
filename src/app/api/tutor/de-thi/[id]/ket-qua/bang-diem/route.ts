// BU-03 P3 — bảng điểm theo học sinh (?chon=dau|cuoi|cao-nhat, mặc định cao-nhat). CÓ TÊN học sinh — đây (và tệp Excel) là chỗ DUY NHẤT; chỉ gia sư chủ đề.
import { NextRequest, NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { failResponse } from "@/lib/deThiServer";
import { CHON_DEFAULT, isChon } from "@/lib/deThiResults";
import { loadBangDiem } from "@/lib/deThiResultsServer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    const { id } = await params;
    const raw = new URL(req.url).searchParams.get("chon");
    if (raw !== null && !isChon(raw)) return NextResponse.json({ error: "chon phải là dau, cuoi hoặc cao-nhat.", code: "BAD_CHON" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const out = await loadBangDiem(auth.userId, id, raw ?? CHON_DEFAULT);
    if (!out.ok) return failResponse(out);
    return NextResponse.json({ rows: out.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/de-thi/[id]/ket-qua/bang-diem]", e);
    return NextResponse.json({ error: "Chưa tải được bảng điểm. Thử lại sau ít phút." }, { status: 500 });
  }
}
