// A3 (BU-02) — phát / tải một TÀI LIỆU lưu trên KiN. KHÔNG có địa chỉ công khai: mỗi lượt đều kiểm quyền, cùng luật với /api/media/[id]/stream.
// Được xem: chủ tệp; quản trị cấp 1 / nội dung; gia sư CHỦ LỚP của một bài đang tham chiếu tệp; học viên "active" / "suspended" của lớp có bài tham chiếu; bài `isFree` (vẫn phải đăng nhập).
// "Bài tham chiếu" = Lesson.documents chứa `/api/media/<mã>/file` (gỡ tệp khỏi hết bài ⇒ học sinh không còn mở được). Chưa đăng nhập 401; không đủ quyền 403; mã lạ / chưa ready 404.
// An toàn nội dung: Content-Type lấy từ BẢNG đuôi (không từ tệp), nosniff, CSP chặn mọi thứ (sandbox, trừ PDF vì trình xem PDF của Chrome không chạy trong sandbox), chỉ PDF/ảnh/văn bản mới `inline`.
import { documentFileIds } from "@/lib/lessonMediaServer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canWatchStoredMedia } from "@/lib/lessonGuard";
import { DOCUMENT_MIME_BY_EXT, fileNameExt, parseRangeHeader, safeFileName } from "@/lib/mediaStorage";
import { cloudinaryEnv, cloudinarySignedRawUrl, localPathFor, openLocalRange } from "@/lib/mediaStorageServer";
import { kinFileLink } from "@/lib/giaoTrinh";
import { isLearnerVisible } from "@/lib/lessonStatus";
import { managerOf } from "@/lib/lessonVisibility";

const INLINE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "txt"]);
const base = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" } as const;

const rfc5987 = (s: string): string => encodeURIComponent(s).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401, headers: base });
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404, headers: base });

  const asset = await prisma.fileAsset.findUnique({ where: { id } });
  if (!asset || asset.kind !== "document" || asset.status !== "ready") return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404, headers: base });

  let allowed = asset.ownerId === session.userId;
  if (!allowed) {
    const link = kinFileLink(id);
    const select = { id: true, isFree: true, status: true, documents: true, chapter: { select: { section: { select: { course: { select: { id: true, ownerId: true } } } } } } } as const;
    const mayWatch = async (l: { isFree: boolean; status: string; chapter: { section: { course: { id: string; ownerId: string | null } } } }): Promise<boolean> => {
      const course = l.chapter.section.course;
      // BU-02-PHẲNG (R18): bài Nháp/Ẩn không làm "bài tham chiếu" cho người học; chỉ quản lý lớp. Tệp còn ở bài Đã đăng khác ⇒ vẫn mở qua bài đó.
      if (!isLearnerVisible(l.status) && !managerOf(session, course.ownerId)) return false;
      const enr = session.role === "student"
        ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.userId, courseId: course.id } }, select: { status: true } })
        : null;
      return canWatchStoredMedia({ userId: session.userId, role: session.role, adminRole: session.adminRole ?? null, courseOwnerId: course.ownerId, enrollmentStatus: enr?.status ?? null, lessonIsFree: l.isFree });
    };
    // Bài đã ghi trên tệp trước (rẻ), rồi mới quét theo nội dung. Chỉ tính bài THẬT SỰ còn chứa đường dẫn này (gỡ khỏi hết bài ⇒ không còn ai ngoài chủ mở được).
    const tried: string[] = [];
    if (asset.lessonId) {
      const first = await prisma.lesson.findFirst({ where: { id: asset.lessonId, documents: { contains: link } }, select });
      // Khớp chuỗi con chưa đủ: link ngoài có thể chứa đường dẫn này. Chỉ tính khi mã tệp nằm đúng trong danh sách tài liệu.
      if (first && documentFileIds(first.documents).includes(id)) { tried.push(first.id); allowed = await mayWatch(first); }
    }
    if (!allowed) {
      const lessons = await prisma.lesson.findMany({ where: { documents: { contains: link }, ...(tried.length ? { id: { notIn: tried } } : {}) }, select, take: 20 });
      for (const l of lessons) { if (documentFileIds(l.documents).includes(id) && await mayWatch(l)) { allowed = true; break; } }
    }
  }
  if (!allowed) return NextResponse.json({ error: "Tài liệu này dành cho học sinh của lớp" }, { status: 403, headers: base });

  const ext = fileNameExt(asset.originalName);
  const mime = DOCUMENT_MIME_BY_EXT[ext] ?? "application/octet-stream";
  const download = new URL(req.url).searchParams.get("dl") === "1";
  const inline = !download && INLINE_EXTS.has(ext);
  const csp = ext === "pdf" ? "default-src 'none'" : "default-src 'none'; sandbox";
  const headers: Record<string, string> = {
    ...base, "Content-Type": mime, "Content-Security-Policy": csp,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${rfc5987(safeFileName(asset.originalName))}`,
  };
  const rangeHeader = req.headers.get("range");

  if (asset.driver === "local") {
    const total = asset.bytes ?? 0;
    const range = parseRangeHeader(rangeHeader, total);
    if (range === "invalid") return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${total}` } });
    let path: string;
    try { path = localPathFor(asset.storageKey); } catch { return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404, headers: base }); }
    const f = openLocalRange(path, range);
    if (!f) return NextResponse.json({ error: "Không tìm thấy tệp" }, { status: 404, headers: base });
    return new NextResponse(f.body, {
      status: range ? 206 : 200,
      headers: { ...headers, "Content-Length": String(f.end - f.start + 1), ...(range ? { "Content-Range": `bytes ${f.start}-${f.end}/${f.size}` } : {}) },
    });
  }

  // Cloudinary (raw, authenticated): tải về bằng địa chỉ đã ký rồi chuyển tiếp, địa chỉ thật không lộ cho học sinh.
  const env = cloudinaryEnv();
  if (!env) return NextResponse.json({ error: "Kho tài liệu chưa cấu hình" }, { status: 503, headers: base });
  const up = await fetch(cloudinarySignedRawUrl(env, asset.storageKey), { headers: rangeHeader ? { Range: rangeHeader } : {}, cache: "no-store" });
  if (!up.ok && up.status !== 206) return NextResponse.json({ error: "Không mở được tài liệu lúc này" }, { status: 502, headers: base });
  for (const k of ["content-length", "content-range"]) { const v = up.headers.get(k); if (v) headers[k] = v; }
  return new NextResponse(up.body, { status: up.status, headers });
}
