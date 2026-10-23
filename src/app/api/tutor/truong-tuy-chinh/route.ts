// Trường tuỳ chỉnh cho hồ sơ học sinh (LO-18). Số trường tối đa cấu hình bằng KIN_CUSTOM_FIELDS_MAX (xem studentProfile.ts).
// Giá trị trong từng hồ sơ thuộc phạm vi đồng ý "extended"; trường tuỳ chỉnh chỉ có CHỮ ngắn, không nhận tệp / ảnh.
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { cleanText } from "@/lib/tutorArea";
import { LABEL_MAX, customFieldsMax } from "@/lib/studentProfile";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const defs = await prisma.studentFieldDef.findMany({ where: { tutorId: auth.userId }, select: { id: true, label: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ fields: defs, max: customFieldsMax() }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const b = await req.json().catch(() => null) as { label?: unknown } | null;
  const label = typeof b?.label === "string" ? cleanText(b.label) : "";
  if (!label) return NextResponse.json({ error: "Nhập tên trường" }, { status: 400 });
  if (label.length > LABEL_MAX) return NextResponse.json({ error: `Tên trường tối đa ${LABEL_MAX} ký tự` }, { status: 400 });
  const max = customFieldsMax();
  const have = await prisma.studentFieldDef.findMany({ where: { tutorId: auth.userId }, select: { label: true } });
  if (have.length >= max) return NextResponse.json({ error: max === 0 ? "Tính năng trường tuỳ chỉnh đang tắt" : `Mỗi gia sư tối đa ${max} trường tuỳ chỉnh. Xoá bớt một trường rồi thêm lại.` }, { status: 409 });
  if (have.some(h => h.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: "Bạn đã có trường tên này" }, { status: 409 });
  const def = await prisma.studentFieldDef.create({ data: { tutorId: auth.userId, label, position: have.length }, select: { id: true, label: true } });
  await logAction(auth.userId, "student_field.create", "StudentFieldDef", def.id, {});
  return NextResponse.json({ field: def }, { status: 201, headers: NO_STORE });
}

export async function DELETE(req: Request) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const def = await prisma.studentFieldDef.findUnique({ where: { id }, select: { id: true, tutorId: true } });
  if (!def) return NextResponse.json({ error: "Không tìm thấy trường" }, { status: 404 });
  if (def.tutorId !== auth.userId) return NextResponse.json({ error: "Trường này không thuộc về bạn" }, { status: 403 });
  // Xoá trường thì xoá luôn giá trị đã nhập ở các hồ sơ của gia sư này (không để dữ liệu mồ côi về trẻ).
  const profiles = await prisma.studentProfile.findMany({ where: { tutorId: auth.userId, NOT: { customData: { equals: Prisma.DbNull } } }, select: { id: true, customData: true } });
  await prisma.$transaction(async tx => {
    for (const p of profiles) {
      const cd = p.customData as Record<string, string> | null;
      if (!cd || typeof cd !== "object" || !(id in cd)) continue;
      const rest = { ...cd }; delete rest[id];
      await tx.studentProfile.update({ where: { id: p.id }, data: { customData: Object.keys(rest).length ? rest : Prisma.JsonNull } });
    }
    await tx.studentFieldDef.delete({ where: { id } });
  });
  await logAction(auth.userId, "student_field.delete", "StudentFieldDef", id, {});
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
