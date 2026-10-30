// TT-203 — Cài đặt của gia sư: module hiển thị + tin nhắc lịch. Lưu theo TÀI KHOẢN.
// PH-215 — thêm mục Kết nối: nhóm Zalo của lớp, Messenger, hiện số Zalo trên hồ sơ (tắt sẵn).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import { getTutorPlan } from "@/lib/planServer";
import { quotaCards } from "@/lib/tutorQuota";
import CaiDatClient from "./CaiDatClient";

export const dynamic = "force-dynamic";

export default async function CaiDatPage() {
  const session = await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/cai-dat" });
  const [me, classes] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { preferences: true, phone: true } }),
    prisma.course.findMany({ where: { ownerId: session.userId }, select: { id: true, name: true, zaloGroupUrl: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  // GO-08: số đo thật. Gói lỗi đọc thì không hiện thẻ (không bịa số); dung lượng cộng từ FileAsset đã tải xong của chính gia sư.
  const [plan, files] = await Promise.all([
    getTutorPlan(session.userId).catch(() => null),
    prisma.fileAsset.aggregate({ where: { ownerId: session.userId, bytes: { not: null } }, _sum: { bytes: true }, _count: { _all: true } }),
  ]);
  const cards = plan ? quotaCards({ students: plan.quota.students, planName: plan.isPro ? "KiN Pro" : "Free", enforced: plan.enforced, storageBytes: files._sum.bytes ?? 0, storageFiles: files._count._all }) : null;
  return <CaiDatClient initial={readPreferences(me?.preferences)} classes={classes} phone={me?.phone ?? null} quota={cards} />;
}
