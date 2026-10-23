import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canWatchStoredMedia } from "@/lib/lessonGuard";
import { parseRangeHeader } from "@/lib/mediaStorage";
import { cloudinaryEnv, cloudinarySignedVideoUrl, localPathFor, openLocalRange } from "@/lib/mediaStorageServer";
import { uploadLink } from "@/lib/mediaLink";

// GET /api/media/[id]/stream — phát video lưu trên KiN. KHÔNG có địa chỉ công khai: mỗi lượt đều kiểm quyền.
// Được xem: chủ video (xem trước khi lưu bài), quản trị, gia sư chủ lớp, học viên đã ghi danh hoặc bài miễn phí tham chiếu video này.
const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline", "Accept-Ranges": "bytes" } as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return NextResponse.json({ error: "Không tìm thấy video" }, { status: 404 });

  const asset = await prisma.fileAsset.findUnique({ where: { id } });
  if (!asset || asset.kind !== "video" || asset.status !== "ready") return NextResponse.json({ error: "Không tìm thấy video" }, { status: 404 });

  let allowed = asset.ownerId === session.userId;
  if (!allowed) {
    // Mọi bài đang dùng video này (một video có thể nằm ở bản sao lớp). Đủ MỘT bài cho phép là được.
    const lessons = await prisma.lesson.findMany({
      where: { videoUrl: { contains: uploadLink(id) } },
      select: { isFree: true, chapter: { select: { section: { select: { course: { select: { id: true, ownerId: true } } } } } } },
      take: 20,
    });
    for (const l of lessons) {
      const course = l.chapter.section.course;
      const enr = session.role === "student"
        ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: course.id } }, select: { status: true } })
        : null;
      if (canWatchStoredMedia({ userId: session.userId, role: session.role, adminRole: session.adminRole ?? null, courseOwnerId: course.ownerId, enrollmentStatus: enr?.status ?? null, lessonIsFree: l.isFree })) { allowed = true; break; }
    }
  }
  if (!allowed) return NextResponse.json({ error: "Video này dành cho học sinh của lớp" }, { status: 403 });

  const rangeHeader = req.headers.get("range");

  if (asset.driver === "local") {
    const total = asset.bytes ?? 0;
    const range = parseRangeHeader(rangeHeader, total);
    if (range === "invalid") return new NextResponse(null, { status: 416, headers: { ...HEADERS, "Content-Range": `bytes */${total}` } });
    let path: string;
    try { path = localPathFor(asset.storageKey); } catch { return NextResponse.json({ error: "Không tìm thấy video" }, { status: 404 }); }
    const f = openLocalRange(path, range);
    if (!f) return NextResponse.json({ error: "Không tìm thấy video" }, { status: 404 });
    const len = f.end - f.start + 1;
    return new NextResponse(f.body, {
      status: range ? 206 : 200,
      headers: { ...HEADERS, "Content-Type": asset.mimeType, "Content-Length": String(len), ...(range ? { "Content-Range": `bytes ${f.start}-${f.end}/${f.size}` } : {}) },
    });
  }

  // Cloudinary: tải về bằng địa chỉ đã ký rồi chuyển tiếp, để địa chỉ thật không lộ cho học sinh.
  const env = cloudinaryEnv();
  if (!env) return NextResponse.json({ error: "Kho video chưa cấu hình" }, { status: 503 });
  const ext = (asset.originalName.split(".").pop() ?? "mp4");
  const up = await fetch(cloudinarySignedVideoUrl(env, asset.storageKey, ext), { headers: rangeHeader ? { Range: rangeHeader } : {}, cache: "no-store" });
  if (!up.ok && up.status !== 206) return NextResponse.json({ error: "Không phát được video lúc này" }, { status: 502 });
  const h: Record<string, string> = { ...HEADERS, "Content-Type": asset.mimeType };
  for (const k of ["content-length", "content-range"]) { const v = up.headers.get(k); if (v) h[k] = v; }
  return new NextResponse(up.body, { status: up.status, headers: h });
}
