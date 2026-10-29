// NC2-046 — danh sách video YouTube trong kho do quản trị chọn (quản lý trung tâm: admin_super, admin_content).
//   GET  → mọi video (kể cả chưa công khai)   ·   POST → thêm một video (kiểm nghiêm ở src/lib/libraryVideo.ts)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { parseLibraryVideoInput } from "@/lib/libraryVideo";
import { thumbUrl, watchUrl } from "@/lib/youtubeLink";

export const dynamic = "force-dynamic";
const MAX_LIBRARY_VIDEOS = 500;

export async function GET() {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const rows = await prisma.libraryVideo.findMany({ orderBy: { createdAt: "desc" }, take: MAX_LIBRARY_VIDEOS });
  const videos = rows.map(r => ({ id: r.id, title: r.title, videoId: r.videoId, url: watchUrl(r.videoId), thumb: thumbUrl(r.videoId), topics: r.topics, channel: r.channel, note: r.note, published: r.published, createdAt: r.createdAt.toISOString() }));
  return NextResponse.json({ videos, total: rows.length, published: rows.filter(r => r.published).length });
}

export async function POST(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const p = parseLibraryVideoInput(await req.json().catch(() => null));
  if (!p.ok) return NextResponse.json({ error: p.error, field: p.field }, { status: 400 });
  if ((await prisma.libraryVideo.count()) >= MAX_LIBRARY_VIDEOS) return NextResponse.json({ error: `Đã đủ ${MAX_LIBRARY_VIDEOS} video — xoá bớt video cũ` }, { status: 409 });
  let row;
  try { row = await prisma.libraryVideo.create({ data: p.value }); }
  catch (e) {
    // videoId là duy nhất: hai yêu cầu cùng lúc cho cùng một video, một cái thua → 409 chứ không 500.
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: "Video này đã có trong kho", field: "url" }, { status: 409 });
    throw e;
  }
  await logAction(auth.userId, "library_video.create", "LibraryVideo", row.id, { title: row.title, published: row.published });
  return NextResponse.json({ id: row.id }, { status: 201 });
}
