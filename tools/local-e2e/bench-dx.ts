// Đo THỜI GIAN thật của hai truy vấn nặng của "Nâng cấp lần 1" trên dữ liệu giả lập lớn (NC1-015 và NC1-054):
//  • loadUnmarkedSessions (ĐX-01): chạy MỖI LẦN gia sư tải số đỏ trên thanh module → phải nhanh. Gia sư "nặng": 10 lớp × 3 buổi/tuần × 30 em, 14 ngày qua, ~70% đã điểm danh.
//  • loadHealthMetrics (ĐX-04): trang quản trị /admin/so-do, quét toàn hệ thống. Hệ thống "lớn": 300 gia sư, 3.600 buổi điểm danh (54.000 bản ghi), 6.000 phiếu, 2.000 khoản tiền.
// Cần Postgres (xem README). XOÁ SẠCH DB thử (wipe). Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/bench-dx.ts
import { mkTutor, mkUser, mkCourse, wipe } from "./h";
import { prisma } from "@/lib/prisma";
import { loadUnmarkedSessions } from "@/lib/unmarkedServer";
import { loadHealthMetrics } from "@/lib/healthMetricsServer";

const DAY = 86_400_000;
const ms = async <T>(label: string, fn: () => Promise<T>) => { const t0 = performance.now(); const r = await fn(); const d = performance.now() - t0; console.log(`  ${label}: ${d.toFixed(0)} ms`); return { r, d }; };
const chunks = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
const dateOnly = (t: Date) => new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));

(async () => {
  await wipe();
  const now = new Date();
  console.log("Dựng dữ liệu…");
  const students = await Promise.all(Array.from({ length: 30 }, (_, i) => mkUser({ name: `HS ${i}` })));

  // ── gia sư nặng cho ĐX-01 ──
  const T0 = await mkTutor("Gia sư nặng");
  const courses0: Awaited<ReturnType<typeof mkCourse>>[] = [];
  for (let c = 0; c < 10; c++) courses0.push(await mkCourse(T0.id, { name: `Lớp nặng ${c}` }));
  const rules = courses0.flatMap(c => [1, 3, 5].map(d => ({ courseId: c.id, dayOfWeek: d, startTime: "17:00", endTime: "18:30", createdAt: new Date(now.getTime() - 40 * DAY) })));
  await prisma.classSchedule.createMany({ data: rules });
  await prisma.enrollment.createMany({ data: courses0.flatMap(c => students.map(s => ({ userId: s.id, courseId: c.id, status: "active", createdAt: new Date(now.getTime() - 60 * DAY) }))) });
  const sess0: { courseId: string; date: Date; createdBy: string }[] = [];
  for (const c of courses0) for (let d = 1; d <= 14; d++) { const dt = dateOnly(new Date(now.getTime() - d * DAY)); if ([1, 3, 5].includes(dt.getUTCDay())) sess0.push({ courseId: c.id, date: dt, createdBy: T0.id }); }
  await prisma.attendanceSession.createMany({ data: sess0 });
  const made0 = await prisma.attendanceSession.findMany({ where: { createdBy: T0.id }, select: { id: true } });
  let n = 0;
  await prisma.attendanceRecord.createMany({ data: made0.flatMap(s => students.filter(() => (n++ % 10) < 7).map(st => ({ sessionId: s.id, userId: st.id, status: "present" }))) });
  console.log(`  gia sư nặng: ${courses0.length} lớp, ${rules.length} khung giờ, ${students.length * courses0.length} ghi danh, ${sess0.length} phiên, ${await prisma.attendanceRecord.count()} bản ghi`);

  // ── hệ thống lớn cho ĐX-04 ──
  const tutors: Awaited<ReturnType<typeof mkTutor>>[] = [];
  for (let i = 0; i < 300; i++) tutors.push(await mkTutor(`GS ${i}`));
  const courses: Awaited<ReturnType<typeof mkCourse>>[] = [];
  for (const t of tutors) courses.push(await mkCourse(t.id, { name: `Lớp của ${t.name}` }));
  const sessData: { courseId: string; date: Date; createdBy: string }[] = [];
  courses.forEach((c, i) => { for (let d = 1; d <= 12; d++) sessData.push({ courseId: c.id, date: dateOnly(new Date(now.getTime() - d * 2 * DAY)), createdBy: tutors[i].id }); });
  for (const part of chunks(sessData, 2000)) await prisma.attendanceSession.createMany({ data: part });
  const ids = (await prisma.attendanceSession.findMany({ where: { createdBy: { in: tutors.map(t => t.id) } }, select: { id: true } })).map(s => s.id);
  const recs = ids.flatMap((sid, k) => students.slice(0, 15).map((st, j) => ({ sessionId: sid, userId: st.id, status: (k + j) % 9 === 0 ? "late" : "present", updatedBy: "x" })));
  for (const part of chunks(recs, 5000)) await prisma.attendanceRecord.createMany({ data: part.map(r => ({ sessionId: r.sessionId, userId: r.userId, status: r.status })) });
  const inv: any[] = [];
  tutors.forEach((t, ti) => { for (let k = 0; k < 20; k++) { const sent = new Date(now.getTime() - (1 + ((ti + k) % 40)) * DAY); inv.push({ code: `BEN${ti}-${k}`, tutorId: t.id, studentId: students[k % 30].id, yearMonth: `2026-${String(1 + (k % 9)).padStart(2, "0")}`, amountDue: 1_200_000, status: k % 3 === 0 ? "paid" : "sent", sentAt: sent, zaloOpenedAt: k % 4 ? sent : null, parentViewedAt: k % 5 === 0 ? sent : null, paidAt: k % 3 === 0 ? sent : null, viewToken: k % 2 ? `tok${ti}-${k}` : null }); } });
  for (const part of chunks(inv, 2000)) await prisma.tuitionInvoice.createMany({ data: part });
  const txs = Array.from({ length: 2000 }, (_, i) => ({ tutorId: tutors[i % 300].id, providerTxId: `b${i}`, occurredAt: new Date(now.getTime() - (i % 60) * DAY), amount: 1_200_000, content: "x", kind: "exact", status: i % 4 === 0 ? "pending" : "matched" }));
  for (const part of chunks(txs, 2000)) await prisma.bankTransaction.createMany({ data: part });
  console.log(`  hệ thống: ${tutors.length} gia sư, ${await prisma.attendanceSession.count()} phiên, ${await prisma.attendanceRecord.count()} bản ghi, ${await prisma.tuitionInvoice.count()} phiếu, ${await prisma.bankTransaction.count()} khoản tiền`);

  console.log("\nĐX-01 loadUnmarkedSessions (gia sư nặng) — 6 lần liên tiếp (lần đầu gồm cả khởi động kết nối):");
  const un: number[] = []; let found = 0;
  for (let i = 0; i < 6; i++) { const { r, d } = await ms(`lần ${i + 1}`, () => loadUnmarkedSessions(T0.id, now)); un.push(d); found = r.length; }
  console.log(`  → tìm được ${found} buổi chưa điểm danh xong; trung vị ${[...un].sort((a, b) => a - b)[3].toFixed(0)} ms, lớn nhất ${Math.max(...un).toFixed(0)} ms`);
  const light = await mkTutor("Gia sư nhẹ"); const lc = await mkCourse(light.id, {});
  await prisma.classSchedule.create({ data: { courseId: lc.id, dayOfWeek: 2, startTime: "19:00", endTime: "20:30", createdAt: new Date(now.getTime() - 40 * DAY) } });
  await ms("gia sư nhẹ (1 lớp, 1 khung)", () => loadUnmarkedSessions(light.id, now));
  const none = await mkTutor("Gia sư chưa có lịch");
  await ms("gia sư chưa có lịch (thoát sớm)", () => loadUnmarkedSessions(none.id, now));

  console.log("\nĐX-04 loadHealthMetrics (hệ thống lớn):");
  const hm: Record<number, number[]> = { 7: [], 30: [], 90: [] };
  for (const days of [30, 7, 90, 30, 30]) { const { d } = await ms(`khoảng ${days} ngày`, () => loadHealthMetrics(days, now)); hm[days].push(d); }
  const snap = await loadHealthMetrics(30, now);
  console.log(`  → kết quả mẫu: ${JSON.stringify({ bank: snap.bank, timeliness: snap.timeliness, tutors: snap.tutors }).slice(0, 360)}`);
  console.log(`  bộ nhớ: ${(process.memoryUsage().heapUsed / 1048576).toFixed(0)} MB heap sau khi đo`);
  process.exit(0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
