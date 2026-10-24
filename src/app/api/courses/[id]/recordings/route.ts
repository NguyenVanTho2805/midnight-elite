import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionChecked } from "@/lib/session";
import { recordingAccess, listCourseRecordings } from "@/lib/classRecordingsServer";
import { checkRecordingLink, cleanRecordingTitle, MAX_RECORDINGS_PER_COURSE } from "@/lib/classRecordings";

const NO_STORE = { "Cache-Control": "private, no-store" };

// GET /api/courses/[id]/recordings — bản ghi của lớp cho gia sư chủ lớp / quản trị / học sinh ĐÃ ghi danh. Không trả tên người nào.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await getSessionChecked();
  const acc = await recordingAccess(session, id);
  if (!acc.ok) return NextResponse.json({ error: acc.error }, { status: acc.status, headers: NO_STORE });
  const { rows, sessions } = await listCourseRecordings(id);
  return NextResponse.json({ role: acc.role, recordings: rows, sessions }, { headers: NO_STORE });
}

// POST /api/courses/[id]/recordings — gia sư chủ lớp / quản trị dán link bản ghi, tuỳ chọn gắn vào một buổi.
// Gửi từ <form> (urlencoded) → chuyển trang 303 về trang Bản ghi kèm ?loi= / ?ok=; gửi JSON → trả JSON.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isForm = !(req.headers.get("content-type") ?? "").includes("application/json");
  const back = (q: string) => NextResponse.redirect(new URL(`/lop-cua-toi/${encodeURIComponent(id)}/ban-ghi?${q}`, req.url), { status: 303, headers: NO_STORE });
  const fail = (status: number, error: string) => (isForm ? back(`loi=${encodeURIComponent(error)}`) : NextResponse.json({ error }, { status, headers: NO_STORE }));

  const { session } = await getSessionChecked();
  const acc = await recordingAccess(session, id);
  if (!acc.ok || acc.role !== "manager") return NextResponse.json({ error: acc.ok ? "Chỉ gia sư của lớp được dán bản ghi" : acc.error }, { status: acc.ok ? 403 : acc.status, headers: NO_STORE });

  let body: Record<string, unknown>;
  if (isForm) { const fd = await req.formData().catch(() => null); body = fd ? Object.fromEntries(fd.entries()) : {}; }
  else body = await req.json().catch(() => ({}));

  const title = cleanRecordingTitle(body.title);
  if (!title.ok) return fail(400, title.error);
  const link = checkRecordingLink(typeof body.url === "string" ? body.url : "");
  if (!link.ok) return fail(400, link.error ?? "Link chưa đúng.");
  // MD-11: phải tick cam kết bản quyền (form gửi "on"; JSON gửi true).
  if (!(body.pledge === true || body.pledge === "on" || body.pledge === "true")) return fail(400, "Hãy đọc và đánh dấu cam kết về quyền chia sẻ nội dung trước khi lưu.");

  let sessionId: string | null = null;
  if (typeof body.sessionId === "string" && body.sessionId) {
    const s = await prisma.attendanceSession.findUnique({ where: { id: body.sessionId }, select: { courseId: true } });
    if (!s || s.courseId !== id) return fail(400, "Buổi học này không thuộc lớp.");
    sessionId = body.sessionId;
  }
  if (await prisma.classRecording.count({ where: { courseId: id } }) >= MAX_RECORDINGS_PER_COURSE) return fail(400, `Mỗi lớp lưu tối đa ${MAX_RECORDINGS_PER_COURSE} bản ghi.`);

  const row = await prisma.classRecording.create({ data: { courseId: id, sessionId, title: title.title, url: link.url, kind: link.kind!, createdBy: session!.userId } });
  return isForm ? back("ok=1") : NextResponse.json({ id: row.id, warning: link.warning }, { status: 201, headers: NO_STORE });
}
