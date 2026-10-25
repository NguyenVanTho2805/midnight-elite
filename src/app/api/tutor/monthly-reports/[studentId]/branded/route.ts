// KiN Pro F3 — tạo bản IN có thương hiệu của báo cáo tháng ĐÃ DUYỆT.
// POST ?yearMonth= → đóng băng thương hiệu hiện tại vào báo cáo (brandSnapshot). Lần sau gọi lại: 200 "existing", không tạo lại, KHÔNG cần Pro.
//   409 chưa duyệt · 403 Free (cổng bật) tạo mới · 400 chưa cài thương hiệu · 404 học sinh không thuộc lớp của gia sư.
// Hết hạn Pro chỉ chặn TẠO MỚI: bản đã tạo vẫn xem và in lại được (trang in đọc ảnh chụp thương hiệu, không hỏi gói).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { isFutureMonth, isYearMonth, loadStudentMonth } from "@/lib/monthlyReportServer";
import { canUse, recordUsage } from "@/lib/planServer";
import { isPlanEnforced } from "@/lib/planLimits";
import { BRANDED_GATE_STATUS, BRANDED_GATE_TEXT, brandedGate, readBrandSnapshot } from "@/lib/docBrand";

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const { studentId } = await params;
  const ym = new URL(req.url).searchParams.get("yearMonth") ?? vnMonthKey(new Date());
  if (!isYearMonth(ym)) return NextResponse.json({ error: "yearMonth phải có dạng YYYY-MM" }, { status: 400 });
  if (isFutureMonth(ym)) return NextResponse.json({ error: "Chưa tới tháng này" }, { status: 400 });

  // 404 (không 403) khi học sinh không thuộc lớp của gia sư: không lộ sự tồn tại. Học sinh đã rời lớp thì không còn loadStudentMonth → 404 như các route chị em.
  const data = await loadStudentMonth(auth.userId, studentId, ym);
  if (!data) return NextResponse.json({ error: "Không tìm thấy học sinh trong lớp của bạn" }, { status: 404 });

  const [report, brandRow, allowed] = await Promise.all([
    prisma.monthlyReport.findUnique({ where: { tutorId_studentId_yearMonth: { tutorId: auth.userId, studentId, yearMonth: ym } }, select: { id: true, approvedAt: true, brandSnapshot: true } }),
    prisma.tutorDocBrand.findUnique({ where: { userId: auth.userId }, select: { displayName: true, accent: true, signature: true } }),
    canUse(auth.userId, "branded_docs"),
  ]);
  const brand = readBrandSnapshot(brandRow);
  const gate = brandedGate({ approved: !!report?.approvedAt, hasSnapshot: readBrandSnapshot(report?.brandSnapshot) !== null, allowed, hasBrand: brand !== null });
  const status = BRANDED_GATE_STATUS[gate.kind];

  if (gate.kind === "existing") return NextResponse.json({ ok: true, existing: true });
  if (gate.kind !== "create") {
    if (gate.kind === "pro_required") await recordUsage(auth.userId, "gate_blocked", { refType: "branded_docs", meta: { feature: "branded_report" } });
    return NextResponse.json({ error: BRANDED_GATE_TEXT[gate.kind], code: gate.kind }, { status });
  }
  // Cổng TẮT mà gia sư không phải Pro: ghi "đếm bóng" để đo (không chặn).
  if (!isPlanEnforced()) {
    const { getTutorPlan } = await import("@/lib/planServer");
    const p = await getTutorPlan(auth.userId).catch(() => null);
    if (p && !p.isPro) await recordUsage(auth.userId, "gate_would_block", { refType: "branded_docs", meta: { feature: "branded_report" } });
  }
  await prisma.monthlyReport.update({ where: { id: report!.id }, data: { brandedAt: new Date(), brandSnapshot: brand as unknown as Prisma.InputJsonValue } });
  await recordUsage(auth.userId, "branded_report", { refType: "monthly_report", refId: report!.id });
  return NextResponse.json({ ok: true, existing: false });
}
