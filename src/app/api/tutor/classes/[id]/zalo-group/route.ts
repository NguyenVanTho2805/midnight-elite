// PH-215 — gắn / bỏ link nhóm Zalo của lớp (Cài đặt → Kết nối). Chỉ chủ lớp.
//   PUT { url: "https://zalo.me/g/…" | null }
// Nhóm Zalo là "cổng phụ huynh": tin điểm danh/nhắc lịch vào nhóm chỉ là tin chung (không tên em, không điểm, không tiền).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { logAction } from "@/lib/auditLog";
import { normalizeZaloGroupUrl } from "@/lib/funnel";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  if (!body || !("url" in body)) return NextResponse.json({ error: "Thiếu url" }, { status: 400 });
  const u = normalizeZaloGroupUrl(body.url);
  if (!u.ok) return NextResponse.json({ error: "Link nhóm Zalo phải có dạng https://zalo.me/g/…" }, { status: 400 });
  const r = await prisma.course.updateMany({ where: { id, ownerId: auth.userId }, data: { zaloGroupUrl: u.value } });
  if (r.count === 0) return NextResponse.json({ error: "Không tìm thấy lớp" }, { status: 404 });
  await logAction(auth.userId, "class.zalo_group", "Course", id, { set: u.value !== null });
  return NextResponse.json({ ok: true, url: u.value });
}
