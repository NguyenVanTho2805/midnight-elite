// Bài tập và kiểm tra của gia sư: GET → { items, courses }. Chỉ gia sư; mọi thứ khoá theo chính gia sư đó.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadBaiTap } from "@/lib/baiTapServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  try {
    return NextResponse.json(await loadBaiTap(auth.userId, new Date()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[GET /api/tutor/bai-tap]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
