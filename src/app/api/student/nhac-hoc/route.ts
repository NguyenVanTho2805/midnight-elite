// LOI-04 — GET /api/student/nhac-hoc (danh sách + mục tự động theo lớp) · POST tạo một nhắc việc.
// JSON + fetch theo mẫu chị em lich-rieng (đặc tả LOI-04 mục 4.0). Cổng: khách 401, gia sư/quản trị (kể cả xem thử) 403 — requireStudentRole.
// Chỉ chủ: mọi truy vấn lọc userId của phiên. Không trả userId/notifiedAt; phần `lop` từ loadHomNay (LOI-03) không có câu hỏi/đáp án/điểm/bài nộp.
// Log lỗi KHÔNG kèm userId, tiêu đề, ghi chú. Không route nào thêm Coin/điểm.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentRole } from "@/lib/studentOnly";
import { limitOrBlock } from "@/lib/rate-limit";
import { vnDateKeyOf } from "@/lib/classSessions";
import { cleanNhacCreate, NHAC_MAX_PER_USER, NHAC_FULL_ERROR } from "@/lib/nhacHoc";
import { loadNhac, checkAttach, readNhacBody, toItems, errName, NHAC_SELECT } from "@/lib/nhacHocServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const noStore = (r: NextResponse) => { r.headers.set("Cache-Control", NO_STORE["Cache-Control"]); return r; };

export async function GET() {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) return noStore(gate);
  try {
    return json(await loadNhac(gate.userId, new Date()));
  } catch (e) {
    console.error("[student/nhac-hoc]", errName(e));
    return json({ error: "Lỗi server" }, 500);
  }
}

export async function POST(req: Request) {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) return noStore(gate);
  const blocked = limitOrBlock(gate.userId, "nhac-hoc-write", 120, 60 * 60_000);
  if (blocked) return noStore(blocked);
  try {
    const body = await readNhacBody(req);
    if (!body.ok) return json({ error: body.error }, body.status);
    const now = new Date();
    const c = cleanNhacCreate(body.value, vnDateKeyOf(now));
    if (!c.ok) return json({ error: c.error }, 400);

    const have = await prisma.studentReminder.count({ where: { userId: gate.userId } });
    if (have >= NHAC_MAX_PER_USER) return json({ error: NHAC_FULL_ERROR }, 409);

    const att = await checkAttach(gate.userId, c.value.courseId, c.value.lessonId);
    if (!att.ok) return json({ error: att.error }, 400);

    const row = await prisma.studentReminder.create({
      data: {
        userId: gate.userId,
        title: c.value.title,
        note: c.value.note,
        tags: c.value.tags,
        dueAt: c.value.dueAt,
        dueHasTime: c.value.dueHasTime,
        courseId: att.courseId,
        lessonId: att.lessonId,
      },
      select: NHAC_SELECT,
    });
    const [item] = await toItems(gate.userId, [row]);
    return json({ item }, 201);
  } catch (e) {
    console.error("[student/nhac-hoc]", errName(e));
    return json({ error: "Lỗi server" }, 500);
  }
}
