// LOI-04 — PATCH / DELETE một nhắc việc. Mọi `where` có userId của phiên: mục của người khác hoặc không có ⇒ 404, không lộ là có tồn tại
// (mẫu lich-rieng/[id]/route.ts). doneAt / notifiedAt do MÁY CHỦ đặt: client gửi doneAt bị bỏ; đổi ngày/giờ hẹn ⇒ notifiedAt = null.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentRole } from "@/lib/studentOnly";
import { limitOrBlock } from "@/lib/rate-limit";
import { vnDateKeyOf } from "@/lib/classSessions";
import { cleanNhacPatch, mergeDue, NHAC_NOT_FOUND_ERROR } from "@/lib/nhacHoc";
import { checkAttach, readNhacBody, toItems, errName, NHAC_SELECT } from "@/lib/nhacHocServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const noStore = (r: NextResponse) => { r.headers.set("Cache-Control", NO_STORE["Cache-Control"]); return r; };
const NOT_FOUND = () => json({ error: NHAC_NOT_FOUND_ERROR }, 404);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) return noStore(gate);
  const blocked = limitOrBlock(gate.userId, "nhac-hoc-write", 120, 60 * 60_000);
  if (blocked) return noStore(blocked);
  const { id } = await params;
  try {
    const body = await readNhacBody(req);
    if (!body.ok) return json({ error: body.error }, body.status);
    const now = new Date();
    const c = cleanNhacPatch(body.value, vnDateKeyOf(now));
    if (!c.ok) return json({ error: c.error }, 400);
    if (!ID_RE.test(id)) return NOT_FOUND();

    const cur = await prisma.studentReminder.findFirst({
      where: { id, userId: gate.userId },
      select: { dueAt: true, dueHasTime: true, doneAt: true, courseId: true, lessonId: true },
    });
    if (!cur) return NOT_FOUND();
    const p = c.value;

    const data: {
      title?: string; note?: string | null; tags?: string[];
      dueAt?: Date | null; dueHasTime?: boolean; notifiedAt?: null;
      doneAt?: Date | null; courseId?: string | null; lessonId?: string | null;
    } = {};
    if (p.title !== undefined) data.title = p.title;
    if ("note" in p) data.note = p.note ?? null;
    if (p.tags !== undefined) data.tags = p.tags;

    const due = mergeDue(cur, p);
    if (!due.ok) return json({ error: due.error }, 400);
    if (due.changed) { data.dueAt = due.dueAt; data.dueHasTime = due.dueHasTime; data.notifiedAt = null; }

    // Bấm "Xong" lại khi đã xong thì giữ mốc cũ (không nhảy thứ tự trong "Đã xong").
    if (p.done !== undefined) data.doneAt = p.done ? (cur.doneAt ?? now) : null;

    const hasCourse = "courseId" in p, hasLesson = "lessonId" in p;
    if (hasCourse || hasLesson) {
      const nextLesson = hasLesson ? (p.lessonId ?? null) : hasCourse && p.courseId !== cur.courseId ? null : cur.lessonId;
      const nextCourse = hasCourse ? (p.courseId ?? null) : nextLesson ? null : cur.courseId;
      if (nextLesson) {
        // Gắn bài: courseId suy từ bài; gửi kèm courseId mà lệch ⇒ lỗi.
        const att = await checkAttach(gate.userId, hasCourse ? nextCourse : null, nextLesson);
        if (!att.ok) return json({ error: att.error }, 400);
        data.courseId = att.courseId; data.lessonId = att.lessonId;
      } else if (nextCourse && nextCourse !== cur.courseId) {
        const att = await checkAttach(gate.userId, nextCourse, null);
        if (!att.ok) return json({ error: att.error }, 400);
        data.courseId = att.courseId; data.lessonId = null;
      } else {
        // Gỡ bài / gỡ lớp / giữ nguyên lớp cũ: không cần kiểm quyền (không gắn thêm gì mới).
        data.courseId = nextCourse; data.lessonId = null;
      }
    }

    const r = await prisma.studentReminder.updateMany({ where: { id, userId: gate.userId }, data });
    if (r.count === 0) return NOT_FOUND();
    const row = await prisma.studentReminder.findFirst({ where: { id, userId: gate.userId }, select: NHAC_SELECT });
    if (!row) return NOT_FOUND();
    const [item] = await toItems(gate.userId, [row]);
    return json({ item });
  } catch (e) {
    console.error("[student/nhac-hoc]", errName(e));
    return json({ error: "Lỗi server" }, 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) return noStore(gate);
  const blocked = limitOrBlock(gate.userId, "nhac-hoc-write", 120, 60 * 60_000);
  if (blocked) return noStore(blocked);
  const { id } = await params;
  if (!ID_RE.test(id)) return NOT_FOUND();
  try {
    const r = await prisma.studentReminder.deleteMany({ where: { id, userId: gate.userId } });
    return r.count === 0 ? NOT_FOUND() : json({ ok: true });
  } catch (e) {
    console.error("[student/nhac-hoc]", errName(e));
    return json({ error: "Lỗi server" }, 500);
  }
}
