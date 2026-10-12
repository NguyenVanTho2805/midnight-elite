// PH-209/210 — lượt mở link hồ sơ của CHÍNH gia sư theo kênh (đuôi ?n=), để biết nhóm Facebook nào mang người về.
// Chỉ đếm lượt bấm link, không đếm được bài đăng trong nhóm.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { CHANNEL_GROUP_LABEL, funnelRows } from "@/lib/funnel";

export async function GET(req: NextRequest) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const daysRaw = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 365 ? daysRaw : 30;
  const grouped = await prisma.profileVisit.groupBy({
    by: ["channel", "kind"],
    where: { tutorId: auth.userId, createdAt: { gte: new Date(Date.now() - days * 24 * 3600_000) } },
    _count: { _all: true },
  });
  const rows = funnelRows(grouped.map(g => ({ channel: g.channel, kind: g.kind, count: g._count._all })));
  return NextResponse.json({ days, rows: rows.map(r => ({ ...r, groupLabel: CHANNEL_GROUP_LABEL[r.group] })) });
}
