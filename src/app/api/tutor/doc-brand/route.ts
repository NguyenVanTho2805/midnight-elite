// KiN Pro F3 — cài đặt thương hiệu giấy tờ của gia sư (tên hiển thị, màu nhấn từ danh sách, chữ ký chữ; chưa có logo).
// GET → { brand | null, canBrand }  (Free khi cổng bật vẫn ĐỌC được cài đặt đã lưu, ví dụ sau khi hết hạn Pro)
// PUT { displayName, accent, signature } → lưu. Chỉ khi canUse('branded_docs'); Free khi cổng bật → 403.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { canUse } from "@/lib/planServer";
import { sanitizeBrand, BRANDED_GATE_TEXT } from "@/lib/docBrand";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const [row, canBrand] = await Promise.all([
    prisma.tutorDocBrand.findUnique({ where: { userId: auth.userId }, select: { displayName: true, accent: true, signature: true } }),
    canUse(auth.userId, "branded_docs"),
  ]);
  return NextResponse.json({ brand: row, canBrand }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 }); }
  const c = sanitizeBrand(body);
  if (!c.ok) return NextResponse.json({ error: c.error }, { status: 400 });
  if (!(await canUse(auth.userId, "branded_docs"))) return NextResponse.json({ error: BRANDED_GATE_TEXT.pro_required, code: "pro_required" }, { status: 403 });
  await prisma.tutorDocBrand.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, ...c.brand },
    update: { ...c.brand },
  });
  return NextResponse.json({ ok: true, brand: c.brand });
}
