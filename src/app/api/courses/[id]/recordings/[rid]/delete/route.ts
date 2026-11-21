import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionChecked } from "@/lib/session";
import { recordingAccess } from "@/lib/classRecordingsServer";
import { recordingsBackPath } from "@/lib/classRecordings";

// POST /api/courses/[id]/recordings/[rid]/delete — gỡ link bản ghi khỏi lớp (POST + 303 như quy ước). Chỉ gia sư chủ lớp / quản trị.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const { session } = await getSessionChecked();
  const acc = await recordingAccess(session, id);
  if (!acc.ok || acc.role !== "manager") return NextResponse.json({ error: acc.ok ? "Chỉ gia sư của lớp được gỡ bản ghi" : acc.error }, { status: acc.ok ? 403 : acc.status });
  // deleteMany theo cả courseId: không xoá nhầm bản ghi của lớp khác dù biết mã.
  await prisma.classRecording.deleteMany({ where: { id: rid, courseId: id } });
  const fd = await req.formData().catch(() => null); // SCL-D: form ở tab Video gửi back=video
  return NextResponse.redirect(new URL(`${recordingsBackPath(id, fd?.get("back"))}?da-go=1`, req.url), { status: 303, headers: { "Cache-Control": "private, no-store" } });
}
