// HP-BO (17/11/2026, chủ: "bỏ luôn phần học phí đi, sau này phát triển sau") — với cờ HOC_PHI TẮT (mặc định production):
//  1. tạo lớp có gửi feeMode / feeRate → lớp mặc định, KHÔNG có đơn giá;
//  2. lớp kiểu mới có sẵn đơn giá (dữ liệu cũ) → lưu điểm danh + "Đã dạy xong" ghi đúng trạng thái nhưng KHÔNG sinh khoản phí, KHÔNG trừ gói;
//  3. API ghi của học phí → 404 { code: "feature_paused" } (GET vẫn chạy);
//  4. hai gia sư cùng đặt tên lớp → lớp sau được mã có hậu tố, không báo lỗi "Slug".
// Máy chủ dev phải chạy KHÔNG có NEXT_PUBLIC_KIN_MO_HOC_PHI (bài tự bỏ qua nếu biến đang đặt ở tiến trình chạy bài).
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-hoc-phi-tat.ts
// Ca phá cố ý (đã chạy 17/11/2026): bỏ chốt featureOn ở close/route.ts → 2 đỏ (ca 2, "0 khoản phí"); bỏ khối pausedApi ở src/proxy.ts → 5 đỏ (ca 3).
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const day = (k: string) => new Date(`${k}T00:00:00Z`);
const BASE_COURSE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/11/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true, noFixedSchedule: true,
};

(async () => {
  if (process.env.NEXT_PUBLIC_KIN_MO_HOC_PHI === "1") { console.log("(máy đang bật HOC_PHI: bỏ qua bài này)"); done(); return; }
  await wipe();
  const A = await mkTutor("Cô Lan"), B = await mkTutor("Thầy Minh");
  const S1 = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" });
  const today = vnDateKeyOf(new Date());
  const past = addDaysKey(today, -2);

  section("1. Tạo lớp có gửi học phí → lớp mặc định, không đơn giá");
  const c1 = await api("POST", "/api/courses", { as: A, body: { ...BASE_COURSE, id: "toan-9-hp-tat", name: "Toán 9", adminName: "Toán 9", shortTitle: "T9", feeMode: "per_session", feeRate: 150_000 } });
  const made = await prisma.course.findUnique({ where: { id: "toan-9-hp-tat" } });
  check("201, feeMode mặc định (monthly_sessions), 0 dòng CourseFeeRate", c1.status === 201 && made?.feeMode === "monthly_sessions" && (await prisma.courseFeeRate.count()) === 0, { s: c1.status, m: made?.feeMode, j: c1.json?.error });

  section("2. Lớp kiểu mới có sẵn đơn giá: điểm danh + Đã dạy xong không sinh phí");
  const cS = (await mkCourse(A.id, { name: "Lý theo buổi" })).id;
  await prisma.course.update({ where: { id: cS }, data: { feeMode: "per_session" } });
  await prisma.courseFeeRate.create({ data: { courseId: cS, mode: "per_session", rate: 150_000, effectiveFrom: "2000-01-01", createdBy: A.id } });
  await prisma.classSchedule.create({ data: { courseId: cS, dayOfWeek: dayOfWeekOfKey(past), startTime: "19:00", endTime: "20:30" } });
  for (const u of [S1, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: cS, status: "active" } });
  const s = await prisma.attendanceSession.create({ data: { courseId: cS, date: day(past), createdBy: A.id } });
  const put = await api("PUT", `/api/attendance-sessions/${s.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "late" }] } });
  check("lưu điểm danh 200, 2 bản ghi có mặt / muộn", put.status === 200 && (await prisma.attendanceRecord.count({ where: { sessionId: s.id } })) === 2, put.json);
  const close = await api("POST", `/api/courses/${cS}/sessions/${past}/close`, { as: A, body: { action: "close" } });
  const after = await prisma.attendanceSession.findUnique({ where: { id: s.id } });
  check("Đã dạy xong 200, buổi state=closed", close.status === 200 && after?.state === "closed", close.json);
  check("TIỀN: 0 khoản phí, 0 lượt trừ gói sau khi chốt", (await prisma.feeCharge.count()) === 0 && (await prisma.sessionPackageUse.count()) === 0 && close.json?.charges === null);
  const put2 = await api("PUT", `/api/attendance-sessions/${s.id}`, { as: A, body: { records: [{ userId: S1.id, status: "present" }, { userId: S2.id, status: "present" }] } });
  check("sửa điểm danh sau khi chốt: 200, vẫn 0 khoản phí", put2.status === 200 && (await prisma.feeCharge.count()) === 0, put2.json);
  const reopen = await api("POST", `/api/courses/${cS}/sessions/${past}/close`, { as: A, body: { action: "reopen" } });
  check("mở lại buổi vẫn chạy (200)", reopen.status === 200, reopen.json);

  section("3. API ghi của học phí đóng (404 feature_paused), GET không bị proxy chặn");
  const writes: [string, string][] = [["POST", `/api/courses/${cS}/fee-rates`], ["POST", `/api/courses/${cS}/packages`], ["POST", "/api/tutor/invoices"], ["POST", "/api/tutor/payout-account"], ["POST", `/api/webhooks/sepay/${A.id}`]];
  for (const [m, p] of writes) {
    const r = await api(m, p, { as: A, body: { rate: 1 } });
    check(`${m} ${p} → 404 feature_paused`, r.status === 404 && r.json?.code === "feature_paused", { s: r.status, j: r.json });
  }
  const g = await api("GET", `/api/courses/${cS}/fee-rates`, { as: A });
  check("GET fee-rates không bị proxy chặn (không có code feature_paused)", g.json?.code !== "feature_paused", g.status);
  check("TIỀN: vẫn chỉ 1 đơn giá (của dữ liệu cũ), 0 gói, 0 phiếu", (await prisma.courseFeeRate.count()) === 1 && (await prisma.sessionPackage.count()) === 0 && (await prisma.tuitionInvoice.count()) === 0);

  section("4. Hai gia sư cùng tên lớp → hậu tố, không lỗi");
  const b1 = await api("POST", "/api/courses", { as: B, body: { ...BASE_COURSE, id: "toan-9-hp-tat", name: "Toán 9", adminName: "Toán 9", shortTitle: "T9" } });
  const b2 = await api("POST", "/api/courses", { as: B, body: { ...BASE_COURSE, id: "toan-9-hp-tat", name: "Toán 9", adminName: "Toán 9", shortTitle: "T9" } });
  check("lần 1 → 201 mã toan-9-hp-tat-2 của Thầy Minh; lần 2 → toan-9-hp-tat-3", b1.status === 201 && b1.json?.id === "toan-9-hp-tat-2" && b2.status === 201 && b2.json?.id === "toan-9-hp-tat-3", [b1.status, b1.json?.id, b2.status, b2.json?.id]);
  check("lớp gốc của Cô Lan không đổi chủ", (await prisma.course.findUnique({ where: { id: "toan-9-hp-tat" } }))?.ownerId === A.id);

  done();
})().catch(e => { console.error(e); process.exit(1); });
