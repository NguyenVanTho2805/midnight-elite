// PH-210 — ghi một lượt mở / xem hết hồ sơ công khai, theo kênh (đuôi ?n=). Không cần tài khoản.
// Gọi từ trình duyệt (không phải lúc máy chủ dựng trang) để bot xem trước link không bị đếm. visitorKey là mã ngẫu nhiên
// theo phiên, chỉ để không đếm trùng; (tutorId, channel, kind, visitorKey) là duy nhất nên mở lại trang không tăng số.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, limitOrBlock } from "@/lib/rate-limit";
import { normalizeChannel } from "@/lib/funnel";
import { readPreferences } from "@/lib/userPreferences";
import { isProfileHidden } from "@/lib/tutorVisibility";

const VISITOR_KEY = /^[A-Za-z0-9-]{8,64}$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const blocked = limitOrBlock(getClientIp(req), "profile-visit", 120, 60 * 60_000);
  if (blocked) return blocked;
  const body = await req.json().catch(() => null) as { n?: unknown; kind?: unknown; vk?: unknown } | null;
  if (body?.kind !== "open" && body?.kind !== "full") return NextResponse.json({ error: "kind phải là open hoặc full" }, { status: 400 });
  if (typeof body.vk !== "string" || !VISITOR_KEY.test(body.vk)) return NextResponse.json({ error: "vk không hợp lệ" }, { status: 400 });
  const tutor = await prisma.user.findFirst({ where: { id, role: "admin", adminRole: "teacher", tutorVerified: true, banned: false, profileLockedAt: null }, select: { id: true, preferences: true } });
  // NC2-022: hồ sơ đang ẨN thì không ai mở được, nên không ghi lượt.
  if (!tutor || isProfileHidden(readPreferences(tutor.preferences))) return NextResponse.json({ error: "Không tìm thấy gia sư" }, { status: 404 });
  const r = await prisma.profileVisit.createMany({ data: [{ tutorId: id, channel: normalizeChannel(body.n), kind: body.kind, visitorKey: body.vk }], skipDuplicates: true });
  return NextResponse.json({ ok: true, counted: r.count === 1 });
}
