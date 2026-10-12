// PH-210 / PH-212 — bảng phễu của quản trị: lượt mở / xem hết hồ sơ theo kênh (?n=), và hàng chờ báo cáo hồ sơ.
// Chỉ quản lý trung tâm (admin_super, admin_content). Không đếm được bài đăng trong nhóm Facebook — chỉ đếm lượt bấm link.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { CHANNEL_GROUP_LABEL, REPORT_REASONS, funnelRows } from "@/lib/funnel";

const DAY = 24 * 3600_000;

export async function GET(req: NextRequest) {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const daysRaw = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 365 ? daysRaw : 30;
  const since = new Date(Date.now() - days * DAY);

  const [grouped, reports, locked] = await Promise.all([
    prisma.profileVisit.groupBy({ by: ["channel", "kind"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.tutorProfileReport.findMany({
      where: { status: "open" }, orderBy: { createdAt: "asc" }, take: 200,
      include: { tutor: { select: { id: true, name: true, profileLockedAt: true } } },
    }),
    prisma.user.count({ where: { profileLockedAt: { not: null } } }),
  ]);
  const rows = funnelRows(grouped.map(g => ({ channel: g.channel, kind: g.kind, count: g._count._all })));
  const openByTutor = new Map<string, number>();
  for (const r of reports) openByTutor.set(r.tutorId, (openByTutor.get(r.tutorId) ?? 0) + 1);

  return NextResponse.json({
    days,
    rows: rows.map(r => ({ ...r, groupLabel: CHANNEL_GROUP_LABEL[r.group] })),
    totals: { opens: rows.reduce((s, r) => s + r.opens, 0), fulls: rows.reduce((s, r) => s + r.fulls, 0) },
    reportsOpen: reports.length,
    lockedProfiles: locked,
    reports: reports.map(r => ({
      id: r.id, tutorId: r.tutorId, tutorName: r.tutor.name, tutorLocked: !!r.tutor.profileLockedAt,
      reason: r.reason, reasonLabel: REPORT_REASONS.find(x => x.key === r.reason)?.label ?? r.reason,
      detail: r.detail, channel: r.channel, createdAt: r.createdAt.toISOString(), openForTutor: openByTutor.get(r.tutorId) ?? 0,
    })),
  });
}
