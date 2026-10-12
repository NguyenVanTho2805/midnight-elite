// FE-099 — nạp dữ liệu khởi đầu có sẵn (SEED_SCORES) vào cơ sở dữ liệu. Chỉ THÊM dòng còn thiếu; dòng đã có giữ nguyên
// (không đè dấu "đã đối chiếu" hay chỉnh sửa của quản trị) nên chạy lại nhiều lần vẫn an toàn.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse } from "@/lib/auth-guard";
import { requireCenterAdmin } from "@/lib/tutorApplicationGuard";
import { logAction } from "@/lib/auditLog";
import { insertMissingScores } from "@/lib/admissionScoreServer";
import { SEED_SCORES } from "@/lib/admissionScoreSeed";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireCenterAdmin();
  if (isNextResponse(auth)) return auth;
  const out = await insertMissingScores(SEED_SCORES);
  await logAction(auth.userId, "admission_score.seed", "AdmissionScore", "seed", { ...out, total: await prisma.admissionScore.count() });
  return NextResponse.json({ ok: true, ...out });
}
