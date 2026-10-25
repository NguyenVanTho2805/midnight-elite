// HP-31 — API/DB: gói buổi trả trước và sổ sử dụng. SỔ BUỔI: không đụng phiếu / dòng phí / tiền. Chỉ lớp kiểu mới theo buổi/giờ.
// Trừ buổi chỉ khi buổi ĐÃ CHỐT và em có mặt/muộn (không dùng buổi bù); sửa điểm danh sau chốt trả/trừ lại; mở lại / xoá buổi trả buổi.
// Cần máy chủ dev đang chạy (BASE). Phần chặn Preview chạy trong tiến trình test.
import { randomBytes } from "node:crypto";
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { createPackage, syncPackageUsesForSession } from "@/lib/sessionPackageServer";

const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};
let seq = 0;
async function createCourse(as: any, extra: Record<string, unknown> = {}) {
  seq++;
  const id = `gb-${Date.now().toString(36)}-${seq}`;
  const r = await api("POST", "/api/courses", { as, body: { ...COURSE_BASE, id, name: `Lớp ${seq}`, adminName: `Lớp ${seq}`, shortTitle: `L${seq}`, ...extra } });
  if (r.status !== 201) throw new Error("tạo lớp lỗi " + JSON.stringify(r.json));
  return id;
}
const enroll = (u: { id: string }, courseId: string) => prisma.enrollment.create({ data: { userId: u.id, courseId, status: "active" } });

(async () => {
  await wipe();
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const G = await mkUser({ name: "Em Giang" }), H = await mkUser({ name: "Em Hà" }), K = await mkUser({ name: "Em Khoa" }), X = await mkUser({ name: "Em Ngoài" });
  const today = vnDateKeyOf(new Date());
  const cP = await createCourse(T1, { feeMode: "per_session", feeRate: 100_000 });
  const cH = await createCourse(T1, { feeMode: "per_hour", feeRate: 200_000, feeSessionMinutes: 90 });
  const cC = await createCourse(T1, { feeMode: "per_course", feeRate: 3_000_000 });
  const cL = (await mkCourse(T1.id, { name: "Lý cũ" })).id;
  for (const u of [G, H, K]) await enroll(u, cP);
  await enroll(G, cH); await enroll(G, cC); await enroll(G, cL);
  const url = (c: string) => `/api/courses/${c}/packages`;
  const mkSess = async (courseId: string, dk: string) => (await api("POST", `/api/courses/${courseId}/attendance-sessions`, { as: T1, body: { date: dk } })).json.id as string;
  const mark = (sid: string, rows: Array<{ userId: string; status: string; makeupCreditId?: string }>) => api("PUT", `/api/attendance-sessions/${sid}`, { as: T1, body: { records: rows } });
  const closeS = (c: string, dk: string) => api("POST", `/api/courses/${c}/sessions/${dk}/close`, { as: T1, body: { action: "close" } });
  const reopenS = (c: string, dk: string) => api("POST", `/api/courses/${c}/sessions/${dk}/close`, { as: T1, body: { action: "reopen", confirm: true } });
  const pk = async (c = cP) => (await api("GET", url(c), { as: T1 })).json.items as any[];
  const of = (items: any[], id: string) => items.find(p => p.id === id);
  const moneySnap = async () => JSON.stringify({
    inv: (await prisma.tuitionInvoice.findMany({ orderBy: { id: "asc" } })).map(i => [i.id, i.amountDue, i.paidAmount, i.status, i.updatedAt.toISOString()]),
    ch: (await prisma.feeCharge.findMany({ orderBy: { id: "asc" } })).map(c => [c.id, c.amount, c.invoiceId, c.updatedAt.toISOString()]),
  });

  section("Quyền và lớp được phép");
  check("chưa đăng nhập → 401; học sinh → 403", (await api("GET", url(cP))).status === 401 && (await api("GET", url(cP), { as: G })).status === 403 && (await api("POST", url(cP), { as: G, body: { studentId: G.id, sessions: 5 } })).status === 403);
  check("gia sư KHÁC → 403 (GET, POST, huỷ); lớp không có → 404", (await api("GET", url(cP), { as: T2 })).status === 403 && (await api("POST", url(cP), { as: T2, body: { studentId: G.id, sessions: 5 } })).status === 403 && (await api("GET", url("khong-co"), { as: T1 })).status === 404);
  check("lớp CŨ → 409 (không lập được gói)", (await api("POST", url(cL), { as: T1, body: { studentId: G.id, sessions: 5 } })).status === 409);
  check("lớp theo khoá → 409", (await api("POST", url(cC), { as: T1, body: { studentId: G.id, sessions: 5 } })).status === 409);
  check("[phá] em không học lớp → 400; số buổi 0 / 2,5 / 201 → 400; thiếu em → 400", (await api("POST", url(cP), { as: T1, body: { studentId: X.id, sessions: 5 } })).status === 400 && (await api("POST", url(cP), { as: T1, body: { studentId: G.id, sessions: 0 } })).status === 400 && (await api("POST", url(cP), { as: T1, body: { studentId: G.id, sessions: 2.5 } })).status === 400 && (await api("POST", url(cP), { as: T1, body: { studentId: G.id, sessions: 201 } })).status === 400 && (await api("POST", url(cP), { as: T1, body: { sessions: 5 } })).status === 400);
  check("sau mọi lần bị từ chối: chưa có gói nào", (await prisma.sessionPackage.count()) === 0);

  section("Lập gói: chụp giá lúc lập, không đụng tiền");
  const m0 = await moneySnap();
  const c1 = await api("POST", url(cP), { as: T1, body: { studentId: G.id, sessions: 5, note: "gói tháng 11" } });
  const pG = c1.json.id as string;
  check("201: giá một buổi 100.000 × 5 = 500.000 ghi lại", c1.status === 201 && c1.json.unitPrice === 100_000 && c1.json.totalPrice === 500_000);
  const row0 = of(await pk(), pG);
  check("sổ: gói 5 buổi, đã dùng 0, còn 5, 'active', có tên em và ghi chú", row0.sessions === 5 && row0.used === 0 && row0.balance === 5 && row0.status === "active" && row0.studentName === "Em Giang" && row0.note === "gói tháng 11");
  check("TIỀN: lập gói không đổi phiếu / dòng phí nào (0 lệch)", (await moneySnap()) === m0);
  const hr = await api("POST", url(cH), { as: T1, body: { studentId: G.id, sessions: 4 } });
  check("lớp theo giờ 200.000/giờ × 90 phút: giá một buổi 300.000, gói 4 buổi = 1.200.000", hr.status === 201 && hr.json.unitPrice === 300_000 && hr.json.totalPrice === 1_200_000);
  await api("POST", `/api/courses/${cP}/fee-rates`, { as: T1, body: { action: "set_class", rate: 120_000, effectiveFrom: today } });
  check("đổi đơn giá lớp sau đó KHÔNG đổi gói đã lập (vẫn 100.000/buổi, 500.000)", of(await pk(), pG).unitPrice === 100_000 && of(await pk(), pG).totalPrice === 500_000);

  section("Trừ buổi chỉ khi buổi ĐÃ CHỐT, em có mặt/muộn");
  const d1 = addDaysKey(today, -3);
  const s1 = await mkSess(cP, d1);
  const m1 = await mark(s1, [{ userId: G.id, status: "present" }, { userId: H.id, status: "late" }, { userId: K.id, status: "absent" }]);
  check("[chưa chốt] lưu điểm danh → chưa trừ buổi (used 0), phản hồi nói 'open'", m1.status === 200 && m1.json.packages?.skipped === "open" && of(await pk(), pG).used === 0);
  const cl = await closeS(cP, d1);
  check("[chốt] trừ đúng 1 buổi cho Giang (Hà không có gói, Khoa vắng); còn 4", cl.status === 200 && cl.json.packageUses === 1 && of(await pk(), pG).used === 1 && of(await pk(), pG).balance === 4);
  const use1 = await prisma.sessionPackageUse.findFirstOrThrow({ where: { packageId: pG } });
  check("dòng trừ gắn đúng bản ghi điểm danh, đúng ngày VN, chưa trả", use1.dateKey === d1 && use1.reversedAt === null && use1.sessionId === s1);
  check("TIỀN: chốt vẫn sinh dòng phí theo đường cũ (HP-14), sổ buổi KHÔNG đổi dòng phí đó; báo 'có khoản học phí cùng buổi, chưa vào phiếu'", (await prisma.feeCharge.count({ where: { courseId: cP, studentId: G.id, dateKey: d1 } })) === 1 && of(await pk(), pG).uses[0].chargeLink === "pending");
  const cl2 = await closeS(cP, d1);
  check("[chốt lần hai] không trừ hai lần", cl2.json.already === true && of(await pk(), pG).used === 1);
  await mark(s1, [{ userId: G.id, status: "present" }]);
  check("[lưu lại y nguyên sau chốt] không trừ hai lần (used 1, vẫn 1 dòng trừ)", of(await pk(), pG).used === 1 && (await prisma.sessionPackageUse.count({ where: { packageId: pG } })) === 1);
  await mark(s1, [{ userId: G.id, status: "absent" }]);
  const afterAbs = of(await pk(), pG);
  check("[sửa sau chốt] Giang đổi sang vắng → trả buổi (used 0, còn 5), dòng trừ giữ lại làm lịch sử (reversed)", afterAbs.used === 0 && afterAbs.balance === 5 && afterAbs.uses[0].reversed === true && (await prisma.sessionPackageUse.count({ where: { packageId: pG } })) === 1);
  await mark(s1, [{ userId: G.id, status: "late" }]);
  check("[sửa sau chốt] đổi lại muộn → trừ lại, KHÔNG thêm dòng (vẫn 1 dòng, hết reversed)", of(await pk(), pG).used === 1 && (await prisma.sessionPackageUse.count({ where: { packageId: pG } })) === 1 && (await prisma.sessionPackageUse.findFirstOrThrow({ where: { packageId: pG } })).reversedAt === null);
  await mark(s1, [{ userId: K.id, status: "present" }]);
  check("[sửa sau chốt] lưu em khác (Khoa, chưa có gói) không kéo theo trừ buổi của Giang lần nữa", of(await pk(), pG).used === 1);
  const mkAbs = await prisma.classAbsence.create({ data: { courseId: cP, scheduleId: "s", dateKey: addDaysKey(today, -20), startAt: new Date(), studentId: G.id, reportedBy: "parent", leadMinutes: 600, status: "excused_auto" } });
  const cred = await prisma.makeupCredit.create({ data: { studentId: G.id, courseId: cP, absenceId: mkAbs.id, expiresAt: new Date(Date.now() + 10 * 86400_000) } });
  const d2 = addDaysKey(today, -2);
  const s2 = await mkSess(cP, d2);
  await mark(s2, [{ userId: G.id, status: "present", makeupCreditId: cred.id }]);
  await closeS(cP, d2);
  check("[buổi bù] em dùng buổi bù: có mặt nhưng KHÔNG trừ buổi của gói", of(await pk(), pG).used === 1);

  section("Mở lại / xoá buổi trả buổi; chốt lại trừ lại");
  const ro = await reopenS(cP, d1);
  check("[mở lại] trả buổi (used 0, còn 5); lịch sử còn", ro.status === 200 && of(await pk(), pG).used === 0 && of(await pk(), pG).uses.length === 1);
  await closeS(cP, d1);
  check("[chốt lại] trừ lại đúng 1 buổi (không nhân đôi)", of(await pk(), pG).used === 1 && (await prisma.sessionPackageUse.count({ where: { packageId: pG } })) === 1);
  const dDel = addDaysKey(today, -1);
  const sDel = await mkSess(cP, dDel);
  await mark(sDel, [{ userId: G.id, status: "present" }]);
  await closeS(cP, dDel);
  check("(chuẩn bị) buổi thứ hai trừ → used 2", of(await pk(), pG).used === 2);
  const del = await api("DELETE", `/api/attendance-sessions/${sDel}`, { as: T1 });
  check("[xoá buổi] không lỗi; buổi được trả (used 1), dòng giữ lại làm lịch sử", del.status === 200 && of(await pk(), pG).used === 1);

  section("Hết buổi, gói sau, huỷ gói");
  const dates = [-9, -8, -7, -6, -5].map(n => addDaysKey(today, n));
  for (const dk of dates) { const sid = await mkSess(cP, dk); await mark(sid, [{ userId: G.id, status: "present" }]); await closeS(cP, dk); }
  const full = of(await pk(), pG);
  check("5 buổi gói: dùng tối đa 5 (không âm), trạng thái 'Đã dùng hết', còn 0", full.used === 5 && full.balance === 0 && full.status === "used_up", full);
  const dExtra = addDaysKey(today, -4);
  const sEx = await mkSess(cP, dExtra); await mark(sEx, [{ userId: G.id, status: "present" }]); await closeS(cP, dExtra);
  check("buổi thứ 6 khi gói đã hết: KHÔNG trừ quá (vẫn 5), không dòng âm", of(await pk(), pG).used === 5 && (await prisma.sessionPackageUse.count({ where: { packageId: pG, reversedAt: null } })) === 5);
  const g2 = await api("POST", url(cP), { as: T1, body: { studentId: G.id, sessions: 3 } });
  const pG2 = g2.json.id as string;
  check("gói lập SAU không trừ ngược các buổi đã chốt từ trước (used 0)", of(await pk(), pG2).used === 0);
  await mark(sEx, [{ userId: G.id, status: "present" }]);
  check("sửa điểm danh buổi chốt TRƯỚC khi lập gói 2 cũng không kéo buổi cũ vào gói 2 (used 0)", of(await pk(), pG2).used === 0);
  const dNew = addDaysKey(today, 0);
  const sNew = await mkSess(cP, dNew); await mark(sNew, [{ userId: G.id, status: "present" }]); await closeS(cP, dNew);
  check("buổi chốt SAU khi lập gói 2: trừ vào gói 2 (gói 1 đã hết)", of(await pk(), pG2).used === 1 && of(await pk(), pG).used === 5);
  const cx = await api("POST", `/api/courses/${cP}/packages/${pG2}`, { as: T1, body: { action: "cancel" } });
  check("huỷ gói 2 → 200, trạng thái 'Đã huỷ', buổi đã trừ giữ trong sổ", cx.status === 200 && of(await pk(), pG2).status === "cancelled" && of(await pk(), pG2).used === 1);
  check("huỷ lần hai → 409; gia sư khác → 403; gói của lớp khác → 404; action lạ → 400", (await api("POST", `/api/courses/${cP}/packages/${pG2}`, { as: T1, body: { action: "cancel" } })).status === 409 && (await api("POST", `/api/courses/${cP}/packages/${pG2}`, { as: T2, body: { action: "cancel" } })).status === 403 && (await api("POST", `/api/courses/${cH}/packages/${pG2}`, { as: T1, body: { action: "cancel" } })).status === 404 && (await api("POST", `/api/courses/${cP}/packages/${pG2}`, { as: T1, body: { action: "xoa" } })).status === 400);
  const dAfterCancel = addDaysKey(today, 1);
  const g3 = await api("POST", url(cP), { as: T1, body: { studentId: H.id, sessions: 2 } });
  check("gói đã huỷ không trừ nữa: buổi sau khi huỷ không vào gói 2", (await prisma.sessionPackage.findUniqueOrThrow({ where: { id: pG2 } })).status === "cancelled" && g3.status === 201);
  // Hà có gói mới 2 buổi; buổi chốt mới của Hà trừ vào gói của Hà, không phải gói của Giang
  const dH = addDaysKey(today, 0);
  await mark(sNew, [{ userId: H.id, status: "present" }, { userId: G.id, status: "present" }]);
  await reopenS(cP, dH); await closeS(cP, dH);
  const pH = of(await pk(), g3.json.id);
  check("mỗi em một sổ: Hà trừ gói của Hà (1), Giang không bị trừ nhầm gói của Hà", pH.used === 1 && pH.studentId === H.id);

  section("Phụ huynh chỉ thấy đúng em của mình (Sổ của con) — chỉ trình bày");
  const PG = await mkUser({ name: "Phụ huynh Giang" }), PH = await mkUser({ name: "Phụ huynh Hà" }), PK = await mkUser({ name: "Phụ huynh Khoa" });
  const tok = async (p: { id: string }, s: { id: string }) => { const t = randomBytes(16).toString("hex"); await prisma.parentLink.create({ data: { parentId: p.id, studentId: s.id, status: "verified", verifiedAt: new Date(), portalToken: t } }); return t; };
  const tG = await tok(PG, G), tH = await tok(PH, H), tK = await tok(PK, K);
  const portalG = await api("GET", `/api/parent-portal/${tG}`), portalH = await api("GET", `/api/parent-portal/${tH}`), portalK = await api("GET", `/api/parent-portal/${tK}`);
  check("phụ huynh Giang thấy gói của Giang (gói 1 hết buổi, gói lớp giờ 4 buổi), KHÔNG gói đã huỷ, KHÔNG gói của Hà", portalG.status === 200 && portalG.json.packages.length === 2 && portalG.json.packages.every((p: any) => p.status !== "cancelled") && portalG.json.packages.some((p: any) => p.sessions === 5 && p.balance === 0));
  check("phụ huynh Hà chỉ thấy gói 2 buổi của Hà (đã dùng 1, còn 1)", portalH.json.packages.length === 1 && portalH.json.packages[0].sessions === 2 && portalH.json.packages[0].used === 1 && portalH.json.packages[0].balance === 1);
  check("phụ huynh Khoa (không có gói) → mảng rỗng", portalK.json.packages.length === 0);
  const rawG = JSON.stringify(portalG.json.packages);
  check("API phụ huynh KHÔNG trả giá, ghi chú, tên gia sư, mã gia sư/học sinh khác", !/unitPrice|totalPrice|note|gói tháng 11|Cô Lan|Em Hà|Em Khoa/.test(rawG) && Object.keys(portalG.json.packages[0]).sort().join() === "balance,courseName,sessions,status,used,uses");

  section("Lớp cũ không bao giờ trừ buổi; chặn Preview; đồng thời; nhật ký");
  const legacyPkg = await prisma.sessionPackage.create({ data: { tutorId: T1.id, courseId: cL, studentId: G.id, sessions: 5, unitPrice: 50_000, totalPrice: 250_000, createdBy: T1.id } });
  const legacySess = await prisma.attendanceSession.create({ data: { courseId: cL, date: new Date(`${addDaysKey(today, -2)}T00:00:00Z`), createdBy: T1.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: legacySess.id, userId: G.id, status: "present" } });
  const clL = await closeS(cL, addDaysKey(today, -2));
  check("[lớp cũ] dù có sẵn một dòng gói trong DB, chốt buổi lớp cũ không trừ buổi nào", clL.status === 200 && clL.json.packageUses === 0 && (await prisma.sessionPackageUse.count({ where: { packageId: legacyPkg.id } })) === 0);
  const savedEnv = process.env.VERCEL_ENV; process.env.VERCEL_ENV = "preview";
  try {
    const n0 = await prisma.sessionPackage.count();
    const pc = await createPackage({ courseId: cP, by: T1.id, input: { studentId: K.id, sessions: 3, note: null } });
    const sync = await prisma.$transaction(tx => syncPackageUsesForSession(tx, sNew));
    check("[Preview] lập gói → 503, không ghi; trừ buổi → skipped=preview", !pc.ok && pc.status === 503 && (await prisma.sessionPackage.count()) === n0 && sync.skipped === "preview");
  } finally { if (savedEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = savedEnv; }
  const gK = await api("POST", url(cP), { as: T1, body: { studentId: K.id, sessions: 2 } });
  const sRace = await prisma.attendanceSession.create({ data: { courseId: cP, date: new Date(`${addDaysKey(today, -30)}T00:00:00Z`), createdBy: T1.id } });
  await prisma.attendanceRecord.createMany({ data: [{ sessionId: sRace.id, userId: K.id, status: "present" }, { sessionId: sRace.id, userId: H.id, status: "present" }] });
  const race = await Promise.all([1, 2, 3].map(() => closeS(cP, addDaysKey(today, -30))));
  check("3 lần chốt đồng thời một buổi: đều 200; Khoa bị trừ đúng 1 buổi, không dòng trùng", race.every(r => r.status === 200) && (await prisma.sessionPackageUse.count({ where: { packageId: gK.json.id } })) === 1);
  const logs = JSON.stringify(await prisma.auditLog.findMany({ where: { action: { startsWith: "session_package." } } }));
  check("nhật ký lập/huỷ gói có, KHÔNG chứa tên em", logs.includes("session_package.create") && logs.includes("session_package.cancel") && !/Em Giang|Em Hà|Em Khoa/.test(logs));
  check("TIỀN: cả đợt thao tác gói không tạo/xoá phiếu nào (không phiếu nào được lập)", (await prisma.tuitionInvoice.count()) === 0);
  await done();
})();
