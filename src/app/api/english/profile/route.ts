// GET/PATCH /api/english/profile — mục tiêu band, ngày thi, số từ mới mỗi ngày.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, getProfile, bad } from "@/lib/english/server";

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  return NextResponse.json(await getProfile(s.userId));
}

export async function PATCH(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return bad("Dữ liệu không hợp lệ");
  const data: Record<string, unknown> = {};
  if (b.targetBand !== undefined) {
    const t = Number(b.targetBand);
    if (!(t >= 4 && t <= 9) || (t * 2) % 1 !== 0) return bad("Band mục tiêu từ 4.0 đến 9.0, bước 0.5");
    data.targetBand = t;
  }
  if (b.examDate !== undefined) {
    if (b.examDate === null || b.examDate === "") data.examDate = null;
    else if (typeof b.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.examDate) && !Number.isNaN(Date.parse(b.examDate))) data.examDate = b.examDate;
    else return bad("Ngày thi phải có dạng YYYY-MM-DD");
  }
  if (b.dailyNew !== undefined) {
    const n = Number(b.dailyNew);
    if (!Number.isInteger(n) || n < 0 || n > 50) return bad("Số từ mới mỗi ngày từ 0 đến 50");
    data.dailyNew = n;
  }
  if (b.dailyMinutes !== undefined) {
    const n = Number(b.dailyMinutes);
    if (!Number.isInteger(n) || n < 10 || n > 480) return bad("Số phút mỗi ngày từ 10 đến 480");
    data.dailyMinutes = n;
  }
  await getProfile(s.userId);
  return NextResponse.json(await prisma.engProfile.update({ where: { userId: s.userId }, data }));
}
