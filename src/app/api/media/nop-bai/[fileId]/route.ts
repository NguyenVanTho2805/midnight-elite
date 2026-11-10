// BU-HS-NOP-TEP A6 — tải / xem MỘT tệp bài nộp hoặc tệp gia sư trả. KHÔNG có địa chỉ công khai và KHÔNG đưa cho trình duyệt URL ký rời: mỗi lượt đều kiểm phiên + quyền
// (canViewNopTepFile, bảng 3.3), phần "ký" là chữ ký Cloudinary giữa máy chủ KiN và Cloudinary, không bao giờ rời máy chủ.
// Thứ tự: 401 → định dạng id (404) → hàng có (404) → quyền (401/403/404) → hết hạn (410, ngay cả khi cron chưa chạy) → phát.
// Tiêu đề: Content-Type theo bảng đuôi, `attachment` (PDF + ?xem=1 ⇒ inline), nosniff, no-store, CSP chặn mọi thứ. Quản trị trung tâm tải ⇒ ghi nhật ký (chỉ fileId + assignmentId, không tên tệp).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isNextResponse } from "@/lib/auth-guard";
import { logAction } from "@/lib/auditLog";
import { parseRangeHeader } from "@/lib/mediaStorage";
import { cloudinaryEnv, cloudinarySignedRawUrl, localPathFor, openLocalRange } from "@/lib/mediaStorageServer";
import { NOP_TEP_EXPIRED_MESSAGE, NOP_TEP_MIME_BY_EXT, canViewNopTepFile, isNopTepId, nopTepStoredName, type NopTepExt } from "@/lib/nopTep";
import { graderGate } from "@/lib/nopTepServer";

const base = {
  "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex", "Accept-Ranges": "bytes",
} as const;
const fail = (error: string, status: number, code?: string) => NextResponse.json({ error, ...(code ? { code } : {}) }, { status, headers: base });
const rfc5987 = (s: string): string => encodeURIComponent(s).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const auth = await requireSession();
  if (isNextResponse(auth)) return auth;
  const { fileId } = await params;
  if (!isNopTepId(fileId)) return fail("Không tìm thấy tệp", 404);
  const row = await prisma.submissionFile.findUnique({ where: { id: fileId } });
  if (!row) return fail("Không tìm thấy tệp", 404);

  const now = new Date();
  let enrollment: string | null = null, linkedParent = false, grader = false, namesVisible = true, graderRole = "";
  if (auth.role === "student") {
    if (auth.userId === row.studentUserId) {
      enrollment = (await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: auth.userId, courseId: row.courseId } }, select: { status: true } }))?.status ?? null;
    } else {
      linkedParent = !!(await prisma.parentLink.findFirst({ where: { parentId: auth.userId, studentId: row.studentUserId, status: "verified" }, select: { id: true } }));
    }
  } else {
    // Cổng chấm: chủ lớp / đồng giảng hiệu lực / bộ môn trong phạm vi / quản trị cấp 1 + nội dung. Lớp khác ⇒ 403; bài không còn ⇒ 404.
    const gate = await graderGate(row.assignmentId);
    if (!gate.ok) return gate.res;
    grader = true; namesVisible = gate.namesVisible; graderRole = gate.role;
  }

  const decision = canViewNopTepFile({
    now, file: { kind: row.kind, status: row.status, submissionId: row.submissionId, studentUserId: row.studentUserId, ownerUserId: row.ownerUserId, deletedAt: row.deletedAt, expiresAt: row.expiresAt },
    viewer: { userId: auth.userId, role: auth.role }, enrollment, grader, linkedParent,
  });
  if (!decision.ok) {
    if (decision.status === 410) return fail(NOP_TEP_EXPIRED_MESSAGE, 410, "expired");
    if (decision.status === 403 && decision.code === "enrollment") return fail("Bạn không còn trong lớp này nên không mở được bài đã nộp.", 403, "enrollment");
    return fail(decision.status === 404 ? "Không tìm thấy tệp" : decision.status === 401 ? "Vui lòng đăng nhập" : "Bạn không có quyền mở tệp này", decision.status);
  }

  if (graderRole === "admin") await logAction(auth.userId, "submission_file.download", "SubmissionFile", row.id, { fileId: row.id, assignmentId: row.assignmentId });

  const ext = (row.ext === "pdf" ? "pdf" : "docx") as NopTepExt;
  // Tên trong tiêu đề theo quyền thấy tên: bộ môn ngoài nhóm nhận tên chung (không lộ tên thật qua Content-Disposition).
  const shown = namesVisible ? nopTepStoredName(row.originalName, ext) : `Bài nộp 1.${ext}`;
  const inline = ext === "pdf" && new URL(req.url).searchParams.get("xem") === "1";
  const headers: Record<string, string> = {
    ...base, "Content-Type": NOP_TEP_MIME_BY_EXT[ext],
    "Content-Security-Policy": ext === "pdf" ? "default-src 'none'" : "default-src 'none'; sandbox",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${rfc5987(shown)}`,
  };
  const rangeHeader = req.headers.get("range");

  if (row.driver === "local") {
    const total = row.sizeBytes ?? 0;
    const range = parseRangeHeader(rangeHeader, total);
    if (range === "invalid") return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${total}` } });
    let path: string;
    try { path = localPathFor(row.storageKey); } catch { return fail("Không tìm thấy tệp", 404); }
    const f = openLocalRange(path, range);
    if (!f) return fail("Không tìm thấy tệp", 404);
    return new NextResponse(f.body, { status: range ? 206 : 200, headers: { ...headers, "Content-Length": String(f.end - f.start + 1), ...(range ? { "Content-Range": `bytes ${f.start}-${f.end}/${f.size}` } : {}) } });
  }

  // Cloudinary (raw, authenticated): tải về bằng địa chỉ đã ký rồi chuyển tiếp; địa chỉ thật không bao giờ lộ.
  const env = cloudinaryEnv();
  if (!env) return fail("Kho tệp chưa cấu hình", 503);
  const up = await fetch(cloudinarySignedRawUrl(env, row.storageKey), { headers: rangeHeader ? { Range: rangeHeader } : {}, cache: "no-store" });
  if (!up.ok && up.status !== 206) return fail("Không mở được tệp lúc này", 502);
  for (const k of ["content-length", "content-range"]) { const v = up.headers.get(k); if (v) headers[k] = v; }
  return new NextResponse(up.body, { status: up.status, headers });
}
