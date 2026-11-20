// LOI-04 — POST /api/student/nhac-hoc/xoa-da-xong: xoá mọi nhắc việc ĐÃ XONG của chính em (doneAt khác null). Không thân. Trả { deleted: n }.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentRole } from "@/lib/studentOnly";
import { limitOrBlock } from "@/lib/rate-limit";
import { errName } from "@/lib/nhacHocServer";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const noStore = (r: NextResponse) => { r.headers.set("Cache-Control", NO_STORE["Cache-Control"]); return r; };

export async function POST() {
  const gate = await requireStudentRole();
  if (gate instanceof NextResponse) return noStore(gate);
  const blocked = limitOrBlock(gate.userId, "nhac-hoc-write", 120, 60 * 60_000);
  if (blocked) return noStore(blocked);
  try {
    const r = await prisma.studentReminder.deleteMany({ where: { userId: gate.userId, doneAt: { not: null } } });
    return json({ deleted: r.count });
  } catch (e) {
    console.error("[student/nhac-hoc]", errName(e));
    return json({ error: "Lỗi server" }, 500);
  }
}
