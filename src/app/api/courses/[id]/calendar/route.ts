// LI-02 / LI-17 — màu của lớp trên Lịch (bảng 25 màu token) và link học online CHUNG của lớp.
//   PATCH { calendarColor?: "lop-01".."lop-25" | null, classJoinUrl?: "https://…" | null }
//   GET → { calendarColor, classJoinUrl }
// Thứ tự ưu tiên link khi hiện cho học viên: riêng buổi > theo khung giờ > chung lớp (xem resolveJoinUrl).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isClassColorKey } from "@/lib/classColor";
import { normalizeJoinUrl } from "@/lib/classSessions";
import { authorizeCourse } from "@/lib/sessionBookServer";
import { logAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  return NextResponse.json({ calendarColor: r.course.calendarColor, classJoinUrl: r.course.classJoinUrl }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await authorizeCourse(id);
  if ("res" in r) return r.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const data: { calendarColor?: string | null; classJoinUrl?: string | null } = {};
  if ("calendarColor" in body) {
    if (body.calendarColor === null || body.calendarColor === "") data.calendarColor = null;
    else if (isClassColorKey(body.calendarColor)) data.calendarColor = body.calendarColor;
    else return NextResponse.json({ error: "Màu phải chọn trong bảng 25 màu" }, { status: 400 });
  }
  if ("classJoinUrl" in body) {
    const j = normalizeJoinUrl(body.classJoinUrl);
    if (!j.ok) return NextResponse.json({ error: "Link vào lớp phải là địa chỉ http(s) hợp lệ" }, { status: 400 });
    data.classJoinUrl = j.value;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Chưa có gì để lưu" }, { status: 400 });
  const row = await prisma.course.update({ where: { id }, data, select: { calendarColor: true, classJoinUrl: true } });
  await logAction(r.auth.userId, "course.calendar", "Course", id, { fields: Object.keys(data) });
  return NextResponse.json(row);
}
