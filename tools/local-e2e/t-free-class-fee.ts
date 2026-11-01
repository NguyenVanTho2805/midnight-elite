// BU-01 · TIỀN (chỉ GỌI, không sửa mã tiền) — lớp "Miễn phí" không tự sinh phí / phiếu; gia sư tự nhập đơn giá thì phí sinh như mọi lớp.
// Chứng minh bất biến spec 6.3: nhãn Miễn phí + việc vào lớp (open / approve) KHÔNG tạo FeeCharge / TuitionInvoice; chỉ CHỐT BUỔI + có đơn giá mới sinh phí.
// Cần máy chủ Next ở cổng 3100 + Postgres demo (COO chạy tuần tự). Mẫu: t-hocphi-fee.ts.
import fs from "node:fs";
import path from "node:path";
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

const FORM = { "content-type": "application/x-www-form-urlencoded" };
const form = (p: string, as: TUser | undefined, pairs: [string, string][] = []) => api("POST", p, { as, raw: new URLSearchParams(pairs), headers: FORM });
const loc = (r: { headers: Headers }) => r.headers.get("location") ?? "";
const codeOf = (r: { headers: Headers }) => new URL(loc(r), "http://x").searchParams.get("code") ?? "";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An Mien Phi" });
  const B = await mkUser({ name: "Em Binh Mien Phi" });
  const P = await mkUser({ name: "Em Pending Cho Duyet" });
  const dk = addDaysKey(vnDateKeyOf(new Date()), -1);
  const ym = dk.slice(0, 7);
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Nguyen Thi Lan" } });

  const closeUrl = (cid: string) => `/api/courses/${cid}/sessions/${dk}/close`;
  const runSession = async (courseId: string, rows: { userId: string; status: string }[]) => {
    const s = await api("POST", `/api/courses/${courseId}/attendance-sessions`, { as: T, body: { date: dk } });
    await api("PUT", `/api/attendance-sessions/${s.json.id}`, { as: T, body: { records: rows } });
    return api("POST", closeUrl(courseId), { as: T, body: { action: "close" } });
  };

  // ── (a) Lớp miễn phí, vào ngay, KHÔNG nhập phí ──────────────────────────────
  section("(a) Lớp Miễn phí (open), không nhập phí: chốt buổi → 0 phí, 0 phiếu");
  const F = await mkCourse(T.id, { name: "Lớp Miễn Phí" });
  await prisma.course.update({ where: { id: F.id }, data: { tag: "Miễn phí", price: 0, joinPolicy: "open" } });
  const ja = await form(`/api/courses/${F.id}/join`, A); const jb = await form(`/api/courses/${F.id}/join`, B);
  check("hai em vào ngay bằng /join", ja.status === 303 && jb.status === 303 && (await prisma.enrollment.count({ where: { courseId: F.id, status: "active" } })) === 2, [ja.status, jb.status]);
  check("vào lớp không tạo FeeCharge / TuitionInvoice", (await prisma.feeCharge.count()) === 0 && (await prisma.tuitionInvoice.count()) === 0);
  const cl = await runSession(F.id, [{ userId: A.id, status: "present" }, { userId: B.id, status: "late" }]);
  check("chốt buổi 200", cl.status === 200, cl.json);
  check("FeeCharge = 0 sau khi chốt", (await prisma.feeCharge.count({ where: { courseId: F.id } })) === 0, cl.json?.charges);
  const bulk = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: ym, studentIds: [A.id, B.id] } });
  check("lập phiếu hàng loạt: 0 phiếu mới", bulk.status < 500 && (bulk.json?.created?.length ?? 0) === 0, bulk.json);
  check("TuitionInvoice = 0", (await prisma.tuitionInvoice.count({ where: { tutorId: T.id } })) === 0);
  const flag = await api("GET", `/api/courses/${F.id}`);
  check("API lớp báo isFree = true", flag.json?.isFree === true && flag.json?.joinPolicy === "open", flag.json?.isFree);

  // ── (b) Gia sư TỰ NHẬP phí → phí vẫn sinh như mọi lớp ───────────────────────
  section("(b) Gia sư tự nhập đơn giá → có FeeCharge và phiếu");
  const openWithRate = await api("POST", "/api/courses", { as: T, body: {
    id: `bu01-open-${Date.now().toString(36)}`, name: "Lớp open có phí", adminName: "x", shortTitle: "x", category: "Toán", instructor: "K", teacherAvatar: "K", openDate: "01/11/2026",
    types: ["Video"], tag: "Miễn phí", bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, lessons: 0, hours: 0, status: true,
    feeMode: "per_session", feeRate: 100_000, joinPolicy: "open",
  } });
  check("[phá] tạo lớp 'open' mà có nhập đơn giá → 400 (không thể vừa vào-ngay vừa thu phí)", openWithRate.status === 400, openWithRate.json);
  const paidId = `bu01-paid-${Date.now().toString(36)}`;
  const mkPaid = await api("POST", "/api/courses", { as: T, body: {
    id: paidId, name: "Lớp tag miễn phí nhưng có phí", adminName: "x", shortTitle: "x", category: "Toán", instructor: "K", teacherAvatar: "K", openDate: "01/11/2026",
    types: ["Video"], tag: "Miễn phí", bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, lessons: 0, hours: 0, status: true,
    feeMode: "per_session", feeRate: 100_000, joinPolicy: "approve",
  } });
  check("tạo lớp approve + đơn giá 100.000/buổi → 201", mkPaid.status === 201, mkPaid.json);
  const paidFlag = await api("GET", `/api/courses/${paidId}`);
  check("isFree = false khi đã có đơn giá (dù còn tag Miễn phí)", paidFlag.json?.isFree === false, paidFlag.json?.isFree);
  // A xin vào lớp này bằng mã cá nhân, gia sư duyệt
  const code = codeOf(await form(`/api/courses/${paidId}/join`, A));
  const rd = await api("POST", `/api/invites/${code}/redeem`, { as: A });
  check("A gửi yêu cầu → pending", rd.json?.pending === true, rd);
  const reqId = (await prisma.classJoinRequest.findFirstOrThrow({ where: { courseId: paidId, userId: A.id } })).id;
  check("tạo yêu cầu / chờ duyệt chưa sinh phí", (await prisma.feeCharge.count({ where: { courseId: paidId } })) === 0);
  const ap = await form(`/api/tutor/lop/${paidId}/yeu-cau/${reqId}/duyet`, T);
  check("duyệt → vào lớp", loc(ap).endsWith("duyet=ok"), loc(ap));
  check("duyệt vào lớp cũng chưa sinh phí (chưa có buổi chốt)", (await prisma.feeCharge.count({ where: { courseId: paidId } })) === 0);
  await runSession(paidId, [{ userId: A.id, status: "present" }]);
  const fc = await prisma.feeCharge.findMany({ where: { courseId: paidId } });
  check("chốt buổi → đúng 1 FeeCharge 100.000 cho A", fc.length === 1 && fc[0].amount === 100_000 && fc[0].studentId === A.id, fc);
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: ym, studentIds: [A.id] } });
  check("lập phiếu → có phiếu 100.000 (đường tiền cũ chạy y như mọi lớp)", iss.status === 201 && iss.json?.created?.[0]?.amountDue === 100_000, iss.json);

  // ── (c) Lớp cũ price 0: gia sư tự lập phiếu tay vẫn được ────────────────────
  section("(c) Lớp price 0 (cách tính cũ): gia sư tự nhập số buổi tháng → vẫn lập được phiếu");
  const L = await mkCourse(T.id, { name: "Lớp cũ price 0" });
  await prisma.course.update({ where: { id: L.id }, data: { tag: "Miễn phí", joinPolicy: "open" } });
  await form(`/api/courses/${L.id}/join`, B);
  await prisma.monthlyCourseFee.create({ data: { courseId: L.id, yearMonth: ym, sessionCount: 4, updatedBy: T.id } });
  const manual = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: ym, studentIds: [B.id] } });
  check("KiN không cấm: gia sư tự nhập số buổi → phiếu được lập (>0đ)", manual.status === 201 && (manual.json?.created?.[0]?.amountDue ?? 0) > 0, manual.json);

  // ── (d) Em đang chờ duyệt (chưa Enrollment) ─────────────────────────────────
  section("(d) Em đang pending không xuất hiện trong chốt buổi / phiếu");
  const AP = await mkCourse(T.id, { name: "Lớp Duyệt Miễn Phí" });
  await prisma.course.update({ where: { id: AP.id }, data: { tag: "Miễn phí", joinPolicy: "approve" } });
  const codeP = codeOf(await form(`/api/courses/${AP.id}/join`, P));
  await api("POST", `/api/invites/${codeP}/redeem`, { as: P });
  check("P đang pending, chưa có Enrollment", (await prisma.classJoinRequest.count({ where: { courseId: AP.id, userId: P.id, status: "pending" } })) === 1 && (await prisma.enrollment.count({ where: { courseId: AP.id, userId: P.id } })) === 0);
  await api("POST", `/api/courses/${AP.id}/attendance-sessions`, { as: T, body: { date: dk } });
  const detail = await api("GET", `/api/courses/${AP.id}/sessions/${dk}`, { as: T });
  check("chi tiết buổi KHÔNG liệt kê em pending (tên hoặc id)", detail.status === 200 && !detail.text.includes(P.name) && !detail.text.includes(P.id), detail.text.slice(0, 200));
  const closeP = await api("POST", closeUrl(AP.id), { as: T, body: { action: "close" } });
  check("chốt buổi của lớp có em pending → 200, 0 phí", closeP.status === 200 && (await prisma.feeCharge.count({ where: { courseId: AP.id } })) === 0);
  const invP = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: ym, studentIds: [P.id] } });
  check("lập phiếu cho em pending → không có phiếu", (invP.json?.created?.length ?? 0) === 0 && (await prisma.tuitionInvoice.count({ where: { studentId: P.id } })) === 0, invP.json);

  // ── (e) Tĩnh: mã BU-01 không chạm đường tiền ────────────────────────────────
  section("(e) Tĩnh: tệp BU-01 không nhập / đọc mã tiền");
  const files = [
    "src/lib/joinRequest.ts", "src/lib/enrollServer.ts", "src/lib/classInvite.ts",
    "src/app/api/courses/[id]/join/route.ts", "src/app/api/invites/[id]/redeem/route.ts", "src/app/api/invites/by-code/[code]/route.ts",
    "src/app/api/invites/my-requests/route.ts", "src/app/api/invites/my-requests/[id]/cancel/route.ts",
    "src/app/api/tutor/lop/[courseId]/yeu-cau/route.ts", "src/app/api/tutor/lop/[courseId]/yeu-cau/[id]/duyet/route.ts",
    "src/app/api/tutor/lop/[courseId]/yeu-cau/[id]/tu-choi/route.ts", "src/app/api/tutor/lop/[courseId]/yeu-cau/hang-loat/route.ts",
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.resolve(f), "utf8");
    const code = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    const bad = [/feeCharge/i, /invoiceServer/, /sessionBook/, /tuitionInvoice/i, /\bCourse\.price\b/, /\.price\b/].filter(re => re.test(code));
    // joinRequest.ts / by-code / join đọc `price` CHỈ để xét nhãn "Miễn phí" (isFreeClass) — tách riêng: ở đó cho phép chữ `price` nhưng cấm mọi nhập mã tiền.
    const priceAllowed = /joinRequest\.ts|by-code|\/join\/route|courses\/\[id\]\/route/.test(f);
    const real = bad.filter(re => !(priceAllowed && /price/.test(re.source)));
    check(`${f}: không nhập / dùng mã tiền`, real.length === 0, real.map(String));
  }

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
