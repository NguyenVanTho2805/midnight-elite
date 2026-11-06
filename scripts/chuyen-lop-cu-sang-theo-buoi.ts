// HOCPHI-THEO-BUOI 3.5 (phần B, CHỦ-01) — chuyển lớp CŨ (monthly_sessions) sang tính học phí THEO BUỔI từ đầu một tháng S.
// KHÔNG tự chạy: mặc định DRY-RUN (chỉ đọc). Ghi thật cần --apply --yes (và trên production thêm --allow-production --confirm-month).
//
//   npx tsx scripts/chuyen-lop-cu-sang-theo-buoi.ts --from-month 2026-12 --rates tep.json [--course id,id | --owner userId]
//   npx tsx scripts/chuyen-lop-cu-sang-theo-buoi.ts ... --apply --yes [--allow-production --confirm-month 2026-12]
//
// tep.json: {"<courseId>": <đồng/buổi>}. Lớp thiếu đơn giá → BỎ QUA (không đoán từ bậc thang cũ).
// Mã thoát: 0 xong · 1 thiếu/ sai tham số hoặc --apply thiếu --yes (đã in kế hoạch) · 2 bị chặn (production thiếu cờ, hoặc bản xem trước) · 3 lỗi khi ghi.
// Chỉ THÊM dữ liệu (CourseFeeRate, FeeCharge, AuditLog, Notification) và đổi MỘT cột Course.feeMode. Không sửa, không xoá phiếu / FeeCharge / MonthlyCourseFee.
// Đầu ra có tên lớp + id, KHÔNG có tên học sinh.
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { vnDateKeyOf } from "@/lib/classSessions";
import { vnMonthKey } from "@/lib/revenue";
import { isYearMonth } from "@/lib/hocPhiDashboard";
import { lockAttendanceSession, syncChargesOnClose } from "@/lib/feeChargeServer";
import { NEW_FEE_MODES, isChargeableStatus, isNewFeeMode, validateFeeSetup } from "@/lib/tuitionFee";

const BY = "script:chuyen-lop";
const NOTE = "Chuyển từ tính theo tháng (CHỦ-01)";

interface Args { fromMonth: string; rates: string; courses: string[] | null; owner: string | null; apply: boolean; yes: boolean; allowProduction: boolean; confirmMonth: string | null }

function parseArgs(argv: string[]): Args | string {
  const a: Args = { fromMonth: "", rates: "", courses: null, owner: null, apply: false, yes: false, allowProduction: false, confirmMonth: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const val = () => { const v = argv[++i]; if (v === undefined || v.startsWith("--")) throw new Error(`${k} cần một giá trị`); return v; };
    try {
      if (k === "--from-month") a.fromMonth = val();
      else if (k === "--rates") a.rates = val();
      else if (k === "--course") a.courses = val().split(",").map(s => s.trim()).filter(Boolean);
      else if (k === "--owner") a.owner = val();
      else if (k === "--confirm-month") a.confirmMonth = val();
      else if (k === "--apply") a.apply = true;
      else if (k === "--yes") a.yes = true;
      else if (k === "--allow-production") a.allowProduction = true;
      else return `Tham số lạ: ${k}`;
    } catch (e) { return (e as Error).message; }
  }
  if (!isYearMonth(a.fromMonth)) return "Thiếu hoặc sai --from-month (YYYY-MM)";
  if (!a.rates) return "Thiếu --rates tep.json";
  return a;
}

function nextMonth(ym: string): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 12 ? `${String(y + 1).padStart(4, "0")}-01` : `${ym.slice(0, 4)}-${String(m + 1).padStart(2, "0")}`;
}

function dbHost(): string {
  try { const u = new URL(process.env.DATABASE_URL ?? ""); return `${u.host}${u.pathname}`; } catch { return "(không đọc được DATABASE_URL)"; }
}

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

interface Plan {
  courseId: string; courseName: string; ownerId: string | null; rate: number;
  verdict: "DOI" | "BO_QUA"; reason?: string;
  students: number; sessions: string[]; sessionIds: string[]; expected: number; invoiceStatus: Record<string, number>;
}

async function buildPlans(a: Args, rates: Record<string, unknown>): Promise<Plan[]> {
  const S = a.fromMonth;
  const wanted = a.courses ?? Object.keys(rates);
  const courses = await prisma.course.findMany({
    where: { ...(a.owner ? { ownerId: a.owner } : {}), id: { in: wanted } },
    select: { id: true, name: true, feeMode: true, ownerId: true },
    orderBy: { name: "asc" },
  });
  const known = new Set(courses.map(c => c.id));
  const plans: Plan[] = [];
  for (const id of wanted) if (!known.has(id) && !a.owner) plans.push({ courseId: id, courseName: "(không có lớp)", ownerId: null, rate: 0, verdict: "BO_QUA", reason: "không có lớp này", students: 0, sessions: [], sessionIds: [], expected: 0, invoiceStatus: {} });

  // Phiếu / số buổi tháng từ S trở đi: một lần cho mọi lớp.
  const ids = courses.map(c => c.id);
  const [invoices, monthly, feeRateRows, enrollments, sessions] = await Promise.all([
    prisma.tuitionInvoice.findMany({ where: { yearMonth: { gte: S } }, select: { status: true, breakdown: true } }),
    prisma.monthlyCourseFee.findMany({ where: { courseId: { in: ids }, yearMonth: { gte: S }, sessionCount: { gt: 0 } }, select: { courseId: true } }),
    prisma.courseFeeRate.findMany({ where: { courseId: { in: ids } }, select: { courseId: true } }),
    prisma.enrollment.groupBy({ by: ["courseId"], where: { courseId: { in: ids }, status: "active" }, _count: { _all: true } }),
    prisma.attendanceSession.findMany({
      where: { courseId: { in: ids }, state: "closed", date: { gte: new Date(`${S}-01T00:00:00.000Z`) } },
      select: { id: true, courseId: true, date: true },
    }),
  ]);
  const hasRate = new Set(feeRateRows.map(r => r.courseId));
  const hasMonthly = new Set(monthly.map(m => m.courseId));
  const activeStudents = new Map(enrollments.map(e => [e.courseId, e._count._all]));

  // Ước tính tiền bù: bản ghi có mặt/muộn, trừ em dùng buổi bù ở chính buổi đó.
  const sessionIds = sessions.map(s => s.id);
  const [records, credits] = sessionIds.length
    ? await Promise.all([
        prisma.attendanceRecord.findMany({ where: { sessionId: { in: sessionIds } }, select: { sessionId: true, userId: true, status: true } }),
        prisma.makeupCredit.findMany({ where: { usedSessionId: { in: sessionIds } }, select: { usedSessionId: true, studentId: true } }),
      ])
    : [[], []];
  const used = new Set(credits.map(c => `${c.usedSessionId}:${c.studentId}`));
  const chargeable = new Map<string, number>();
  for (const r of records) if (isChargeableStatus(r.status) && !used.has(`${r.sessionId}:${r.userId}`)) chargeable.set(r.sessionId, (chargeable.get(r.sessionId) ?? 0) + 1);

  for (const c of courses) {
    const raw = rates[c.id];
    const invoiceStatus: Record<string, number> = {};
    let blocking = 0;
    for (const inv of invoices) {
      const bd = inv.breakdown as { perSubject?: Array<{ courseId?: string }> } | null;
      if (!Array.isArray(bd?.perSubject) || !bd!.perSubject!.some(p => p.courseId === c.id)) continue;
      invoiceStatus[inv.status] = (invoiceStatus[inv.status] ?? 0) + 1;
      if (inv.status !== "cancelled") blocking++;
    }
    const mine = sessions.filter(s => s.courseId === c.id);
    const base = {
      courseId: c.id, courseName: c.name, ownerId: c.ownerId, students: activeStudents.get(c.id) ?? 0,
      sessions: mine.map(s => vnDateKeyOf(s.date)), sessionIds: mine.map(s => s.id), invoiceStatus,
    };
    const skip = (reason: string, rate = 0): Plan => ({ ...base, rate, verdict: "BO_QUA", reason, expected: 0 });

    if (isNewFeeMode(c.feeMode)) { plans.push(skip("đã theo buổi")); continue; }
    if (raw === undefined) { plans.push(skip("thiếu đơn giá")); continue; }
    const v = validateFeeSetup({ mode: "per_session", rate: raw });
    if (!v.ok) { plans.push(skip(`đơn giá không hợp lệ (${v.error})`)); continue; }
    if (hasRate.has(c.id)) { plans.push(skip("lớp đã có đơn giá (CourseFeeRate) — không đoán mốc", v.value.rate)); continue; }
    if (blocking > 0) {
      const parts = Object.entries(invoiceStatus).filter(([s]) => s !== "cancelled").map(([s, n]) => `${n} ${s}`).join(", ");
      plans.push(skip(`có phiếu không huỷ từ tháng ${S} chứa lớp này (${parts}) — huỷ và lập lại thì mới chuyển được`, v.value.rate)); continue;
    }
    if (hasMonthly.has(c.id)) { plans.push(skip(`có số buổi tháng (MonthlyCourseFee) từ tháng ${S}`, v.value.rate)); continue; }
    const expected = mine.reduce((s, x) => s + (chargeable.get(x.id) ?? 0) * v.value.rate, 0);
    plans.push({ ...base, rate: v.value.rate, verdict: "DOI", expected });
  }
  return plans;
}

function printPlans(plans: Plan[], S: string) {
  for (const p of plans) {
    const inv = Object.entries(p.invoiceStatus).map(([s, n]) => `${s}=${n}`).join(" ") || "không";
    if (p.verdict === "DOI") {
      console.log(`  ĐỔI      ${p.courseName} [${p.courseId}] · ${vnd(p.rate)}/buổi từ ${S}-01 · ${p.students} học sinh · ${p.sessions.length} buổi đã chốt từ ${S}-01 sẽ tính bù, dự kiến ${vnd(p.expected)} · phiếu liên quan: ${inv}`);
    } else {
      console.log(`  BỎ QUA   ${p.courseName} [${p.courseId}] — ${p.reason} · phiếu liên quan: ${inv}`);
    }
  }
}

async function apply(p: Plan, S: string): Promise<{ ok: boolean; backfilled: number; note?: string }> {
  return prisma.$transaction(async tx => {
    // Chống đua / chạy lại: chỉ đổi khi lớp vẫn đang là cách cũ.
    const moved = await tx.course.updateMany({ where: { id: p.courseId, feeMode: { notIn: [...NEW_FEE_MODES] } }, data: { feeMode: "per_session" } });
    if (moved.count !== 1) return { ok: false, backfilled: 0, note: "lớp đã được đổi bởi lượt khác" };
    await tx.courseFeeRate.create({ data: { courseId: p.courseId, mode: "per_session", rate: p.rate, sessionMinutes: null, effectiveFrom: `${S}-01`, note: NOTE, createdBy: BY } });
    let backfilled = 0;
    for (const sid of p.sessionIds) {
      await lockAttendanceSession(tx, sid);
      const r = await syncChargesOnClose(tx, sid, BY);
      backfilled += r.created;
    }
    await tx.auditLog.create({
      data: { actorId: null, action: "course_fee.convert_to_per_session", resourceType: "Course", resourceId: p.courseId, metadata: { fromMonth: S, rate: p.rate, backfilled, byScript: true } },
    });
    return { ok: true, backfilled };
  }, { timeout: 120_000, maxWait: 20_000 });
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (typeof parsed === "string") { console.error(`Lỗi: ${parsed}\nXem đầu tệp scripts/chuyen-lop-cu-sang-theo-buoi.ts để biết cách dùng.`); return 1; }
  const a = parsed, S = a.fromMonth;
  const host = dbHost();
  const localDb = /^(localhost|127\.0\.0\.1|\[?::1\]?)(:|$)/.test(host);
  // Máy cục bộ nhưng DATABASE_URL trỏ máy chủ thật vẫn coi là production.
  const prod = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || !localDb;

  console.log(`Cơ sở dữ liệu: ${dbHost()}`);
  console.log(`Chế độ: ${a.apply ? "GHI THẬT (--apply)" : "DRY-RUN (không ghi)"} · từ tháng ${S}${prod ? " · PRODUCTION" : ""}`);

  if (process.env.VERCEL_ENV === "preview") { console.error("Từ chối: bản xem trước dùng chung cơ sở dữ liệu production. Không chạy script này ở đây."); return 2; }
  if (a.apply && prod && !(a.allowProduction && a.confirmMonth === S)) {
    console.error(`Từ chối: production cần thêm --allow-production --confirm-month ${S} (đúng bằng --from-month). Không ghi gì.`);
    return 2;
  }

  // P1 (rà soát): mốc tháng chưa nối vào invoiceServer/feeChargeServer (D1). Ghi trước khi nối có thể mất hoặc tính đôi học phí tháng trước mốc.
  if (a.apply && a.yes && process.env.KIN_FLOOR_WIRED !== "1") {
    console.error("Từ chối ghi: mốc tháng chưa được nối vào issueInvoice/syncSessionCharges (yêu cầu D1 chờ COO). Chỉ đặt KIN_FLOOR_WIRED=1 sau khi D1 đã gộp. Không ghi gì.");
    return 2;
  }
  const now = vnMonthKey(new Date());
  if (S !== now && S !== nextMonth(now)) { console.error(`Từ chối cả lượt: --from-month phải là tháng hiện tại (${now}) hoặc tháng kế (${nextMonth(now)}).`); return 1; }

  let rates: Record<string, unknown>;
  try {
    const j = JSON.parse(readFileSync(a.rates, "utf8"));
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("không phải đối tượng JSON");
    rates = j as Record<string, unknown>;
  } catch (e) { console.error(`Không đọc được --rates: ${(e as Error).message}`); return 1; }

  const plans = await buildPlans(a, rates);
  const todo = plans.filter(p => p.verdict === "DOI");
  console.log(`\nKế hoạch (${todo.length} đổi / ${plans.length - todo.length} bỏ qua):`);
  printPlans(plans, S);

  if (!a.apply) { console.log("\nDRY-RUN: chưa ghi gì. Thêm --apply --yes để ghi."); return 0; }
  if (!a.yes) { console.error("\nThiếu --yes: chưa ghi gì."); return 1; }
  if (todo.length === 0) { console.log("\nKhông có lớp nào cần đổi."); return 0; }

  let failed = 0;
  for (const p of todo) {
    try {
      const r = await apply(p, S);
      if (!r.ok) { console.log(`  BỎ QUA   ${p.courseName} [${p.courseId}] — ${r.note}`); continue; }
      console.log(`  ĐÃ ĐỔI   ${p.courseName} [${p.courseId}] · tính bù ${r.backfilled} dòng`);
      if (p.ownerId) {
        await notify(p.ownerId, {
          type: "course_fee_converted",
          title: "Lớp của bạn đã chuyển sang tính học phí theo buổi",
          message: "Một lớp của bạn vừa được chuyển sang tính học phí theo buổi từ đầu tháng. Mở tab Học phí của lớp để xem đơn giá.",
          link: `/lop-cua-toi/${encodeURIComponent(p.courseId)}?tab=hoc-phi`,
        });
      }
    } catch (e) {
      failed++;
      console.error(`  LỖI      ${p.courseName} [${p.courseId}] — ${(e as Error).message} (giao dịch của lớp này đã hoàn tác)`);
    }
  }
  return failed ? 3 : 0;
}

main()
  .then(async code => { await prisma.$disconnect?.(); process.exit(code); })
  .catch(async e => { console.error("Lỗi không lường trước:", (e as Error).message); await prisma.$disconnect?.(); process.exit(3); });
