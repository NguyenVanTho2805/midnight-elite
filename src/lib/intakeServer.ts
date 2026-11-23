// SCL đợt 5 (D1–D9) — phần MÁY CHỦ của phiếu BCA Midnight Class gửi từ Apps Script: tạo / tìm học sinh, ghi danh học thử qua enrollInTx, cấp mã chào một lần.
// Hợp đồng API ở src/app/api/intake/bca/route.ts. KHÔNG chạm đường tiền (không nhập tuition / invoice / feeCharge / sessionBook).
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enrollInTx, logEnrollment } from "@/lib/enrollServer";
import { signupBonusOps } from "@/lib/wallet";
import { logAction } from "@/lib/auditLog";
import { TRIAL_DAYS } from "@/lib/trial";

export const INTAKE_SUBJECTS = ["Toán", "Sử", "Địa", "Anh"] as const;
export type IntakeSubject = (typeof INTAKE_SUBJECTS)[number];
export const WELCOME_TTL_DAYS = 7;

export const hashWelcomeToken = (t: string): string => createHash("sha256").update(t).digest("hex");

/** KIN_INTAKE_COURSES = {"Toán":"<courseId>",...}. JSON hỏng ⇒ {} (mọi môn coi như chưa có lớp). */
export function intakeCourseMap(raw: string | undefined): Partial<Record<IntakeSubject, string>> {
  try {
    const o = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    const out: Partial<Record<IntakeSubject, string>> = {};
    for (const k of INTAKE_SUBJECTS) if (typeof o[k] === "string" && o[k]) out[k] = o[k] as string;
    return out;
  } catch { return {}; }
}

/** Tài khoản có sẵn cần đặt mật khẩu qua trang chào? Chỉ khi chính intake tạo ra nó (đã có mã chào trước), chưa ai đặt mật khẩu qua mã nào, và chưa xác minh email
 *  (Quên mật khẩu bằng Gmail đánh dấu đã xác minh ⇒ em đã tự có mật khẩu). Tài khoản KiN có từ trước intake ⇒ false: KHÔNG bao giờ cho đổi mật khẩu từ trang chào. */
export async function welcomeNeedsPassword(userId: string, emailVerified: boolean): Promise<boolean> {
  if (emailVerified) return false;
  const [all, set] = await Promise.all([
    prisma.intakeWelcome.count({ where: { userId } }),
    prisma.intakeWelcome.count({ where: { userId, passwordSetAt: { not: null } } }),
  ]);
  return all > 0 && set === 0;
}

export interface IntakeInput { loai: "hocthu" | "chinhthuc"; hoTen: string; sdt: string; gmail: string; khoi: string; mon: IntakeSubject[]; reqId: string }
export type IntakeOutcome =
  | { ok: true; skip: "khong_co_lop" }
  | { ok: true; skip?: undefined; token: string; userId: string; createdUser: boolean; enrolled: number; skippedFull: number }
  | { ok: false; status: number; error: string };

export async function runIntake(i: IntakeInput, courseIds: string[], now: Date = new Date()): Promise<IntakeOutcome> {
  // Lớp trong KIN_INTAKE_COURSES đã bị xoá ⇒ coi như môn chưa có lớp; không còn lớp nào ⇒ không tạo tài khoản.
  const courses = await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, ownerId: true, capacity: true, classStatus: true } });
  if (courses.length === 0) return { ok: true, skip: "khong_co_lop" };
  const email = i.gmail.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, banned: true, emailVerified: true } });
  let createdUser = false;
  if (user && user.banned) return { ok: false, status: 409, error: "Tài khoản này đã bị khoá" };
  if (user && user.role !== "student") return { ok: false, status: 409, error: "Gmail này là tài khoản gia sư / quản trị" };
  if (!user) {
    // Như /api/auth/register: băm mật khẩu (ngẫu nhiên, không ai biết — em đặt mật khẩu ở trang chào), ví + xu khởi đầu trong cùng giao dịch.
    const hashed = await bcrypt.hash(randomBytes(24).toString("base64url"), 10);
    try {
      user = await prisma.$transaction(async tx => {
        const u = await tx.user.create({
          data: { name: i.hoTen.trim(), email, password: hashed, phone: i.sdt.trim() || null, role: "student", emailVerified: false },
          select: { id: true, role: true, banned: true, emailVerified: true },
        });
        for (const op of signupBonusOps(tx, u.id)) await op;
        return u;
      }, { timeout: 15_000, maxWait: 10_000 });
      createdUser = true;
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
      user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, banned: true, emailVerified: true } }); // hai lần gọi song song
      if (!user || user.role !== "student" || user.banned) return { ok: false, status: 409, error: "Không dùng được Gmail này" };
    }
  }
  const userId = user.id;
  const needsPassword = createdUser || (await welcomeNeedsPassword(userId, user.emailVerified));

  let enrolled = 0, skippedFull = 0;
  for (const course of courses) {
    // D5 một hạn chung: em đã có ghi danh thử ĐÃ bắt đầu ⇒ môn mới dùng chung mốc đó.
    const started = await prisma.enrollment.findFirst({ where: { userId, trialDays: { not: null }, trialStartedAt: { not: null } }, orderBy: { trialStartedAt: "asc" }, select: { trialStartedAt: true } });
    const r = await prisma.$transaction(async tx => {
      const res = await enrollInTx(tx, {
        userId, course, source: "intake",
        trial: { trialDays: TRIAL_DAYS, trialStartedAt: started?.trialStartedAt ?? null, trialConvertRequestedAt: i.loai === "chinhthuc" ? now : null },
      });
      // Đã có ghi danh lớp này: KHÔNG gia hạn. Phiếu chính thức + ghi danh đang là THỬ ⇒ vào hàng chờ xác nhận. Ghi danh chính thức (trialDays null) không đụng.
      if (res.ok && !res.created && i.loai === "chinhthuc") {
        await tx.enrollment.updateMany({ where: { id: res.enrollmentId, trialDays: { not: null }, trialConvertRequestedAt: null }, data: { trialConvertRequestedAt: now } });
      }
      return res;
    });
    if (r.ok) { if (r.created) { enrolled++; await logEnrollment(userId, r, { courseId: course.id, source: "intake" }); } }
    else skippedFull++;
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.intakeWelcome.create({
    data: { tokenHash: hashWelcomeToken(token), userId, expiresAt: new Date(now.getTime() + WELCOME_TTL_DAYS * 86_400_000), passwordSetAt: needsPassword ? null : now },
  });
  // Nhật ký: không tên, không SĐT, không Gmail.
  await logAction(null, "intake.bca", "User", userId, { loai: i.loai, createdUser, enrolled, skippedFull, courses: courses.length, reqId: i.reqId.slice(0, 64) });
  return { ok: true, token, userId, createdUser, enrolled, skippedFull };
}
