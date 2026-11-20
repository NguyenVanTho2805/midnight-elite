// FE-116 — GET /api/tutors/[id] — hồ sơ chi tiết gia sư công khai.
//
// LOI-05: vỏ mỏng. Phần đọc nằm ở src/lib/tutorPublicProfile.ts (dùng chung với trang máy chủ /mentor/[id]); JSON giữ NGUYÊN từng trường.
// 404 nếu id không tồn tại / chưa duyệt / bị cấm / bị khoá / ẩn hồ sơ (không chênh). Lỗi DB ném ⇒ 500 như cũ.
// Ngoại lệ DUY NHẤT của hồ sơ ẩn: chính gia sư xem trước (?preview=1 + phiên đúng chủ) — chỉ khi đó mới đọc phiên.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loadPublicTutorProfile } from "@/lib/tutorPublicProfile";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const viewerId = preview ? (await getSession())?.userId ?? null : null;
  const data = await loadPublicTutorProfile(prisma, id, { preview, viewerId });
  if (!data) return NextResponse.json({ error: "Không tìm thấy gia sư" }, { status: 404 });
  return NextResponse.json(data);
}
