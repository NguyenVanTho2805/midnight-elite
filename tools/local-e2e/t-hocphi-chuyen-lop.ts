// HOCPHI-THEO-BUOI 3.5 / mục 8 — chạy THẬT scripts/chuyen-lop-cu-sang-theo-buoi.ts bằng child_process trên DB test (không cần máy chủ Next).
// Dry-run không ghi, --apply thiếu --yes, cờ production / preview, các lý do BỎ QUA, chuyển được, phiếu + dòng đã vào phiếu giữ nguyên byte, chạy lại không ghi gì.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-hocphi-chuyen-lop.ts   (wipe() DB test)
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";
import { issueInvoice } from "@/lib/invoiceServer";
import { vnMonthKey } from "@/lib/revenue";
import { check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const day = (k: string) => new Date(`${k}T00:00:00Z`);
const prevYm = (ym: string) => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const dir = mkdtempSync(join(tmpdir(), "chuyen-lop-"));
const ratesFile = (name: string, content: unknown) => { const p = join(dir, name); writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content)); return p; };

function run(args: string[], env: Record<string, string | undefined> = {}) {
  const e: NodeJS.ProcessEnv = { ...process.env };
  delete e.VERCEL_ENV; delete e.NODE_ENV;
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete e[k]; else e[k] = v; }
  const r = spawnSync("npx", ["tsx", "scripts/chuyen-lop-cu-sang-theo-buoi.ts", ...args], { cwd: process.cwd(), env: e, encoding: "utf8", timeout: 120_000 });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
}

const tableCounts = async () => JSON.stringify([
  await prisma.course.count(), await prisma.courseFeeRate.count(), await prisma.feeCharge.count(), await prisma.auditLog.count(), await prisma.notification.count(), await prisma.tuitionInvoice.count(),
]);
/** Phần PHẢI giữ nguyên byte: mọi phiếu, mọi dòng phí đã vào phiếu, mọi số buổi tháng. */
const frozen = async () => JSON.stringify({
  invoices: (await prisma.tuitionInvoice.findMany({ orderBy: { id: "asc" } })),
  charges: (await prisma.feeCharge.findMany({ where: { invoiceId: { not: null } }, orderBy: { id: "asc" } })),
  monthly: (await prisma.monthlyCourseFee.findMany({ orderBy: { id: "asc" } })),
});
const modes = async () => JSON.stringify((await prisma.course.findMany({ orderBy: { id: "asc" }, select: { id: true, feeMode: true } })));

(async () => {
  await wipe();
  const S = vnMonthKey(new Date()), M1 = prevYm(S), today = vnDateKeyOf(new Date());
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const names = ["Em Hà Trúc", "Em Bình An", "Em Chi Mai", "Em Dũng Tiến", "Em Giang Sơn", "Em Hạnh Phúc", "Em Khoa Nam"];
  const st = await Promise.all(names.map(n => mkUser({ name: n })));
  const enroll = (u: { id: string }, courseId: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status: "active" } });
  const mk = async (name: string, owner: string, students: Array<{ id: string }> = []) => { const c = await mkCourse(owner, { name }); for (const s of students) await enroll(s, c.id); return c.id; };
  const closedSession = async (courseId: string, dateKey: string, rows: Array<{ id: string; status: string }>) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date: day(dateKey), createdBy: T1.id, state: "closed", closedAt: new Date(), closedBy: T1.id } });
    for (const r of rows) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: r.id, status: r.status } });
  };

  // Lớp cũ chuyển được: 3 em (2 có mặt/muộn, 1 vắng) ở buổi ĐÃ CHỐT hôm nay + 1 buổi đã chốt THÁNG TRƯỚC (không được tính bù).
  const cOK = await mk("Toán chuyển được", T1.id, [st[0], st[1], st[2]]);
  await closedSession(cOK, today, [{ id: st[0].id, status: "present" }, { id: st[1].id, status: "late" }, { id: st[2].id, status: "absent" }]);
  await closedSession(cOK, `${M1}-10`, [{ id: st[0].id, status: "present" }]);
  // Phiếu của tháng S chứa lớp cũ: issueInvoice không lập phiếu 0đ nên tạm đặt MonthlyCourseFee 4 buổi, lập phiếu, rồi đưa số buổi về 0
  // (phiếu vẫn giữ dòng perSubject của lớp; MonthlyCourseFee sessionCount=0 nên lý do BỎ QUA duy nhất còn lại là chính cái phiếu).
  const inv = async (name: string, who: { id: string }, status: string) => {
    const id = await mk(name, T1.id, [who]);
    await prisma.monthlyCourseFee.create({ data: { courseId: id, yearMonth: S, sessionCount: 4, updatedBy: T1.id } });
    const r: any = await issueInvoice({ tutorId: T1.id, studentId: who.id, yearMonth: S });
    if (r.ok === false) throw new Error("không lập được phiếu thử: " + JSON.stringify(r));
    await prisma.monthlyCourseFee.updateMany({ where: { courseId: id }, data: { sessionCount: 0 } });
    await prisma.tuitionInvoice.updateMany({ where: { studentId: who.id, yearMonth: S }, data: { status, ...(status === "cancelled" ? { cancelReason: "test" } : {}) } });
    return id;
  };
  // Có phiếu HUỶ ở tháng S chứa lớp → vẫn chuyển được (huỷ không chặn).
  const cCanc = await inv("Lý có phiếu huỷ", st[3], "cancelled");
  // Phiếu không huỷ ở tháng S (draft / sent / paid) → BỎ QUA. Mỗi lớp một em riêng để mỗi em đúng một phiếu.
  const cDraft = await inv("Hóa nháp", st[4], "draft"), cSent = await inv("Sinh đã gửi", st[5], "sent"), cPaid = await inv("Văn đã thu", st[6], "paid");
  const cMonthly = await mk("Anh có số buổi tháng", T1.id, [st[0]]);
  await prisma.monthlyCourseFee.create({ data: { courseId: cMonthly, yearMonth: S, sessionCount: 4, updatedBy: T1.id } });
  const cNoRate = await mk("Sử thiếu đơn giá", T1.id, [st[1]]);
  const cBadRate = await mk("Địa đơn giá sai", T1.id, [st[1]]);
  const cNew = await mk("Lớp đã theo buổi", T1.id);
  await prisma.course.update({ where: { id: cNew }, data: { feeMode: "per_session" } });
  await prisma.courseFeeRate.create({ data: { courseId: cNew, mode: "per_session", rate: 100_000, effectiveFrom: "2000-01-01", createdBy: T1.id } });
  const cT2 = await mk("Lớp của thầy khác", T2.id, [st[2]]);

  const rates = ratesFile("rates.json", { [cOK]: 120_000, [cCanc]: 90_000, [cDraft]: 100_000, [cSent]: 100_000, [cPaid]: 100_000, [cMonthly]: 100_000, [cBadRate]: 500, [cNew]: 100_000, [cT2]: 80_000 });
  const base = ["--from-month", S, "--rates", rates, "--owner", T1.id];
  const dbName = (process.env.DATABASE_URL ?? "").split("/").pop() ?? "";
  const pass = (process.env.DATABASE_URL ?? "").match(/\/\/[^:]+:([^@]+)@/)?.[1] ?? "";

  section("Mặc định là DRY-RUN: không ghi gì");
  const c0 = await tableCounts(), f0 = await frozen(), m0 = await modes();
  const d = run(base);
  const leaks = (o: string) => /\/\/[^\s]*:[^\s@]*@/.test(o) || (!!pass && (o.includes(`:${pass}@`) || o.includes(`${pass}@`)));
  check("thoát 0, in 'DRY-RUN' + host/DB (không mật khẩu)", d.code === 0 && d.out.includes("DRY-RUN") && d.out.includes(dbName) && !leaks(d.out), { code: d.code, dbName, leaks: leaks(d.out) });
  check("báo ĐỔI cho lớp chuyển được và lớp có phiếu huỷ", new RegExp(`ĐỔI\\s+Toán chuyển được \\[${cOK}\\]`).test(d.out) && new RegExp(`ĐỔI\\s+Lý có phiếu huỷ \\[${cCanc}\\]`).test(d.out), d.out);
  const line = (name: string) => d.out.split("\n").find(l => l.includes(name)) ?? "";
  check("báo BỎ QUA đúng lý do: phiếu nháp / đã gửi / đã thu, số buổi tháng, thiếu đơn giá, đơn giá sai, đã theo buổi", line("Hóa nháp").includes("BỎ QUA") && line("Hóa nháp").includes("1 draft") && line("Sinh đã gửi").includes("1 sent") && line("Văn đã thu").includes("1 paid") && line("Anh có số buổi tháng").includes("MonthlyCourseFee") && line("Địa đơn giá sai").includes("không hợp lệ") && line("Lớp đã theo buổi").includes("đã theo buổi") && line("Lý có phiếu huỷ").includes("ĐỔI"), ["Hóa nháp", "Sinh đã gửi", "Văn đã thu", "Anh có số buổi tháng", "Sử thiếu đơn giá", "Địa đơn giá sai", "Lớp đã theo buổi", "Lý có phiếu huỷ"].map(line).map(l => l.replace(/\[[^\]]*\]/, "").slice(0, 60)));
  const noRate = run(["--from-month", S, "--rates", rates, "--course", cNoRate]);
  check("lớp được chọn bằng --course mà --rates không có → BỎ QUA (thiếu đơn giá), không đoán đơn giá; lớp không nằm trong --rates mà không chọn thì không bị đụng", noRate.code === 0 && /BỎ QUA\s+Sử thiếu đơn giá[^\n]*thiếu đơn giá/.test(noRate.out) && !d.out.includes("Sử thiếu đơn giá"), noRate.out.slice(-300));
  check("--owner T1: lớp của gia sư khác không có trong kế hoạch", !d.out.includes("Lớp của thầy khác"));
  check("dự kiến: 1 buổi tính bù, 240.000đ (2 em có mặt/muộn × 120.000; em vắng và buổi tháng trước không tính)", /Toán chuyển được[^\n]*1 buổi đã chốt[^\n]*240\.000đ/.test(d.out), d.out.split("\n").filter(l => l.includes("Toán chuyển được")));
  check("đầu ra không có tên học sinh", names.every(n => !d.out.includes(n)));
  check("dry-run: đếm 6 bảng (courses, course_fee_rates, fee_charges, audit_logs, notifications, tuition_invoices) trước = sau; phiếu/dòng/feeMode y nguyên", (await tableCounts()) === c0 && (await frozen()) === f0 && (await modes()) === m0);

  section("--apply thiếu --yes, tham số xấu, tháng đã qua");
  const noYes = run([...base, "--apply"]);
  check("--apply thiếu --yes → mã 1, in kế hoạch, không ghi", noYes.code === 1 && noYes.out.includes("ĐỔI") && noYes.out.includes("Thiếu --yes") && (await tableCounts()) === c0 && (await modes()) === m0, { c: noYes.code, o: noYes.out.slice(-200) });
  const past = run(["--from-month", M1, "--rates", rates, "--apply", "--yes"]);
  check("--from-month tháng đã qua → mã 1, từ chối cả lượt, không ghi", past.code === 1 && past.out.includes("Từ chối") && (await tableCounts()) === c0 && (await modes()) === m0, past.out.slice(-200));
  check("[phá] --from-month sai định dạng / thiếu --rates / --rates không có / --rates là mảng / tham số lạ → mã 1, không ghi", [
    run(["--from-month", "2026-13", "--rates", rates, "--apply", "--yes"]), run(["--from-month", S, "--apply", "--yes"]), run(["--from-month", S, "--rates", join(dir, "khong-co.json"), "--apply", "--yes"]),
    run(["--from-month", S, "--rates", ratesFile("arr.json", [1, 2]), "--apply", "--yes"]), run([...base, "--xoa-het"]), run(["--from-month", S, "--rates", ratesFile("bad.json", "{khong phai json"), "--apply", "--yes"]),
  ].every(r => r.code === 1) && (await tableCounts()) === c0 && (await modes()) === m0);

  section("production / preview: thiếu cờ → mã 2, không ghi");
  const full = [...base, "--apply", "--yes"];
  const prodNone = run(full, { NODE_ENV: "production" });
  const prodV = run(full, { VERCEL_ENV: "production" });
  const prodAllowOnly = run([...full, "--allow-production"], { VERCEL_ENV: "production" });
  const prodWrongMonth = run([...full, "--allow-production", "--confirm-month", M1], { NODE_ENV: "production" });
  const prodConfirmOnly = run([...full, "--confirm-month", S], { VERCEL_ENV: "production" });
  check("NODE_ENV=production hoặc VERCEL_ENV=production, thiếu cờ / sai tháng xác nhận → mã 2", [prodNone, prodV, prodAllowOnly, prodWrongMonth, prodConfirmOnly].every(r => r.code === 2) && prodNone.out.includes("PRODUCTION"), [prodNone, prodV, prodAllowOnly, prodWrongMonth, prodConfirmOnly].map(r => r.code));
  check("… và không ghi gì", (await tableCounts()) === c0 && (await modes()) === m0 && (await frozen()) === f0);
  const prev1 = run(full, { VERCEL_ENV: "preview" }), prev2 = run([...full, "--allow-production", "--confirm-month", S], { VERCEL_ENV: "preview" }), prev3 = run(base, { VERCEL_ENV: "preview" });
  check("VERCEL_ENV=preview → luôn mã 2 kể cả có đủ cờ và kể cả dry-run; không ghi", prev1.code === 2 && prev2.code === 2 && prev3.code === 2 && (await tableCounts()) === c0 && (await modes()) === m0, [prev1.code, prev2.code, prev3.code]);

  section("--apply --yes: chuyển được");
  const ap = run([...base, "--apply", "--yes"]);
  check("thoát 0; báo ĐÃ ĐỔI hai lớp, không tên học sinh, không mật khẩu", ap.code === 0 && ap.out.split("\n").filter(l => l.includes("ĐÃ ĐỔI")).length === 2 && names.every(n => !ap.out.includes(n)) && !leaks(ap.out), ap.out);
  const okDb = await prisma.course.findUniqueOrThrow({ where: { id: cOK } });
  const okRate = await prisma.courseFeeRate.findMany({ where: { courseId: cOK } });
  check("lớp OK: feeMode = per_session; 1 CourseFeeRate rate 120.000, effectiveFrom = S-01, createdBy script, có ghi chú", okDb.feeMode === "per_session" && okRate.length === 1 && okRate[0].rate === 120_000 && okRate[0].effectiveFrom === `${S}-01` && okRate[0].createdBy === "script:chuyen-lop" && !!okRate[0].note, okRate);
  const okCh = await prisma.feeCharge.findMany({ where: { courseId: cOK } });
  check("FeeCharge bù cho buổi đã chốt tháng S: đúng 2 dòng 120.000 (có mặt + muộn), em vắng không có; buổi tháng trước KHÔNG được tính bù", okCh.length === 2 && okCh.every(c => c.amount === 120_000 && c.yearMonth === S && c.dateKey === today && c.invoiceId === null) && new Set(okCh.map(c => c.studentId)).size === 2 && !okCh.some(c => c.studentId === st[2].id), okCh);
  const cancDb = await prisma.course.findUniqueOrThrow({ where: { id: cCanc } });
  check("lớp có phiếu huỷ cũng chuyển được (phiếu huỷ không chặn), 0 dòng bù vì chưa có buổi chốt", cancDb.feeMode === "per_session" && (await prisma.feeCharge.count({ where: { courseId: cCanc } })) === 0);
  const au = await prisma.auditLog.findMany({ where: { action: "course_fee.convert_to_per_session" } });
  const auOK = au.find(a => a.resourceId === cOK);
  check("AuditLog course_fee.convert_to_per_session: 1 dòng mỗi lớp đã đổi, metadata fromMonth/rate/backfilled=2/byScript, actor null", au.length === 2 && !!auOK && auOK.actorId === null && (auOK.metadata as any).fromMonth === S && (auOK.metadata as any).rate === 120_000 && (auOK.metadata as any).backfilled === 2 && (auOK.metadata as any).byScript === true, au.map(a => a.metadata));
  const nt = await prisma.notification.findMany({ where: { type: "course_fee_converted" } });
  check("đúng 1 Notification course_fee_converted mỗi lớp đã đổi, gửi chủ lớp, link tab Học phí, KHÔNG chữ số / tên", nt.length === 2 && nt.every(n => n.userId === T1.id && n.link?.endsWith("?tab=hoc-phi") && !/\d/.test(`${n.title} ${n.message}`) && !names.some(x => `${n.title}${n.message}`.includes(x))) && new Set(nt.map(n => n.link)).size === 2, nt);
  const skipped = [cDraft, cSent, cPaid, cMonthly, cNoRate, cBadRate, cT2];
  check("lớp BỎ QUA (phiếu nháp/đã gửi/đã thu, số buổi tháng, thiếu đơn giá, đơn giá sai) và lớp của gia sư khác: feeMode giữ cách cũ, 0 CourseFeeRate, 0 audit", (await Promise.all(skipped.map(id => prisma.course.findUniqueOrThrow({ where: { id } })))).every(c => c.feeMode === "monthly_sessions") && (await prisma.courseFeeRate.count({ where: { courseId: { in: skipped } } })) === 0 && au.every(a => !skipped.includes(a.resourceId)));
  check("MỌI phiếu, mọi dòng đã vào phiếu, mọi MonthlyCourseFee giữ nguyên byte (băm JSON trước/sau)", (await frozen()) === f0);
  check("lớp đã theo buổi sẵn (cNew) không bị đụng: vẫn 1 CourseFeeRate 2000-01-01", (await prisma.courseFeeRate.findMany({ where: { courseId: cNew } })).length === 1);

  section("Chạy lại → không ghi gì (idempotent)");
  const c1 = await tableCounts(), f1 = await frozen(), m1 = await modes();
  const again = run([...base, "--apply", "--yes"]);
  check("thoát 0; hai lớp báo BỎ QUA (đã theo buổi); không ĐỔI/ĐÃ ĐỔI nào", again.code === 0 && !/ĐÃ ĐỔI/.test(again.out) && !/^\s*ĐỔI\s/m.test(again.out) && (again.out.match(/đã theo buổi/g) ?? []).length >= 3, again.out);
  check("đếm 6 bảng + phiếu/dòng + feeMode y nguyên sau lần chạy lại", (await tableCounts()) === c1 && (await frozen()) === f1 && (await modes()) === m1);

  section("Chọn lớp: --course / --owner");
  const cSel1 = await mk("Chọn một", T1.id), cSel2 = await mk("Chọn hai", T1.id);
  const ratesSel = ratesFile("sel.json", { [cSel1]: 110_000, [cSel2]: 110_000, [cT2]: 80_000 });
  const one = run(["--from-month", S, "--rates", ratesSel, "--course", cSel1, "--apply", "--yes"]);
  check("--course cSel1 → chỉ cSel1 đổi; cSel2 và lớp của T2 giữ nguyên", one.code === 0 && (await prisma.course.findUniqueOrThrow({ where: { id: cSel1 } })).feeMode === "per_session" && (await prisma.course.findUniqueOrThrow({ where: { id: cSel2 } })).feeMode === "monthly_sessions" && (await prisma.course.findUniqueOrThrow({ where: { id: cT2 } })).feeMode === "monthly_sessions", one.out);
  const own = run(["--from-month", S, "--rates", ratesSel, "--owner", T2.id, "--apply", "--yes"]);
  check("--owner T2 → chỉ lớp của T2 đổi; cSel2 (của T1) giữ nguyên; T2 nhận 1 thông báo", own.code === 0 && (await prisma.course.findUniqueOrThrow({ where: { id: cT2 } })).feeMode === "per_session" && (await prisma.course.findUniqueOrThrow({ where: { id: cSel2 } })).feeMode === "monthly_sessions" && (await prisma.notification.count({ where: { userId: T2.id, type: "course_fee_converted" } })) === 1, own.out);
  check("sau mọi lượt: phiếu/dòng đã vào phiếu/MonthlyCourseFee vẫn y nguyên byte", (await frozen()) === f0);
  await done();
})();
