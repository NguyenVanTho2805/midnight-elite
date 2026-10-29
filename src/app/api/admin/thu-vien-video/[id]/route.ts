// NC2-046 — sửa / xoá một video trong kho. PATCH nhận một phần trường; video sau khi gộp phải hợp lệ như khi tạo mới.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseLibraryVideoInput } from "@/lib/libraryVideo";
import { watchUrl } from "@/lib/youtubeLink";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const cur = await prisma.libraryVideo.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "Không tìm thấy video" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const merged = { title: cur.title, url: watchUrl(cur.videoId), topics: cur.topics, channel: cur.channel, note: cur.note, published: cur.published, ...(body as object) };
  const p = parseLibraryVideoInput(merged);
  if (!p.ok) return NextResponse.json({ error: p.error, field: p.field }, { status: 400 });
  try { await prisma.libraryVideo.update({ where: { id }, data: p.value }); }
  catch (e) {
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: "Video này đã có trong kho", field: "url" }, { status: 409 });
    throw e;
  }
  await logAction(auth.userId, "library_video.update", "LibraryVideo", id, { fields: Object.keys(body as object) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const { id } = await params;
  const r = await prisma.libraryVideo.deleteMany({ where: { id } });
  if (r.count === 0) return NextResponse.json({ error: "Không tìm thấy video" }, { status: 404 });
  await logAction(auth.userId, "library_video.delete", "LibraryVideo", id);
  return NextResponse.json({ ok: true });
}
