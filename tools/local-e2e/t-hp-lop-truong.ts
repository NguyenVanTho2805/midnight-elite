// HP-LOP-TRUONG — API (máy chủ dev + Postgres thử): học phí theo BẢNG THÁNG của lớp (Course.feeMode = "monthly_sheet"). Đặc tả: docs/kin/phong-ban/dac-ta/HP-LOP-TRUONG.md
// (mục 0a THẮNG: quản trị XEM + SỬA qua money.view/money.edit, chủ lớp nhận ĐÚNG MỘT thông báo course_fee_override; kỳ thu có ngày bắt đầu 1..28; subjectCountSource file|counted).
// Chạy (máy chủ bật bằng wt-up.sh): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-hp-lop-truong.ts     (cũng chạy được với TZ=UTC / TZ=Asia/Ho_Chi_Minh cho tiến trình test)
// DB riêng bị wipe(). Tự dựng dữ liệu bằng prisma (không sửa h.ts / seed*). Tên học sinh là TÊN GIẢ.
//
// Ca phá cố ý (bẻ X thì ca Y đỏ) — đã thử thật, xem phiếu bàn giao:
//   - bỏ `sheetGate`/`requireCourseAccess` ở một route                                       → ca "quyền: 7 điểm vào" đỏ (401/403 thành 200)
//   - xem trước gọi `writeSheetRows` / audit                                                  → ca "xem trước KHÔNG ghi" đỏ (đếm bảng đổi)
//   - `writeSheetRows` bỏ kiểm `invoiceId` (khoá) hoặc bỏ `FOR UPDATE` + advisory lock         → ca "khoá" / "song song" đỏ
//   - `auditSheetWrite` thôi thông báo chủ lớp khi quản trị ghi / thông báo cả khi chủ tự ghi → ca "đúng MỘT thông báo" / "chủ tự ghi: 0" đỏ
//   - tin số tiền khách gửi lên / bỏ `computeSheetFee` ở máy chủ                               → ca "số khách gửi lên bị bỏ qua" đỏ
//   - cho `enable` chạy trên lớp đã có FeeCharge                                              → ca "HAS_MONEY_HISTORY" đỏ
//   - `invites/by-code` thôi chặn bậc chung cho lớp bảng                                       → ca "tuition: null" đỏ
//   - sửa `invoiceServer`/`tuition` để lớp bảng vào `legacyEnrollments`                         → mục BẤT BIẾN đỏ (phiếu lớp cũ của em học hai lớp đổi bậc)
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { BASE, api, check, cookieFor, done, mkCourse, mkSuper, mkTutor, mkUser, section, wipe, type TUser } from "./h";
import { vnDateKeyOf } from "@/lib/classSessions";
import { canDo } from "@/lib/courseAccess";
import { moneyPathsBlocked } from "@/lib/feeChargeServer";
import { issueInvoice } from "@/lib/invoiceServer";
import { TUITION_TIER_VND, computeMonthlyFee, pricePerSessionVnd } from "@/lib/tuition";
import { stableStringify } from "@/lib/hocPhiSheet";

// ─────────────────────────────── hằng số + tiện ích ───────────────────────────────
const SUBJ = ["Toán", "Sử", "Địa", "Anh"];
const TIERS = [{ subjects: 1, rate: 70000 }, { subjects: 2, rate: 60000 }, { subjects: 3, rate: 55000 }, { subjects: 4, rate: 50000 }];
const NAMES = ["Mai Anh", "Bảo Châu", "Minh Khôi", "Gia Hân", "Tuấn Kiệt"];
const NET: Record<string, number> = { "Mai Anh": 610000, "Bảo Châu": 1500000, "Minh Khôi": 360000, "Gia Hân": 660000, "Tuấn Kiệt": 0 };
const TOTAL = 3130000;
const HEAD = ["Mã em", "Họ tên", "Số môn", "Toán", "Sử", "Địa", "Anh", "Buổi miễn phí", "Đơn giá riêng", "Học bổng", "Giảm trừ", "Ghi chú"];
type Cells = Record<string, string | number>;
const tsv = (rows: Cells[], head: string[] = HEAD) => [head.join("\t"), ...rows.map(r => head.map(h => String(r[h] ?? "")).join("\t"))].join("\n");
const FIVE: Cells[] = [
  { "Họ tên": "Mai Anh", Toán: 8, Anh: 4, "Buổi miễn phí": 1, "Học bổng": 50000 },
  { "Họ tên": "Bảo Châu", Toán: 8, Sử: 8, Địa: 8, Anh: 8, "Giảm trừ": 100000 },
  { "Họ tên": "Minh Khôi", Toán: 8, "Đơn giá riêng": 45000 },
  { "Họ tên": "Gia Hân", Toán: 6, Sử: 6, "Số môn": 3 },
  { "Họ tên": "Tuấn Kiệt", Anh: 4, "Học bổng": 300000 },
];
const FIVE_TEXT = tsv(FIVE);

const nowKey = vnDateKeyOf(new Date());
const YM = nowKey.slice(0, 7);
const shiftYm = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const i = y * 12 + (m - 1) + by; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const YM_PREV = shiftYm(YM, -1);
/** Kỳ hiện tại của lớp có ngày bắt đầu d, tính ĐỘC LẬP với thư viện (cùng quy tắc đặc tả 0a #8). */
const periodOf = (d: number) => (Number(nowKey.slice(8, 10)) >= d ? YM : YM_PREV);
const LABEL = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

const J = (r: { json: unknown }) => (r.json ?? {}) as Record<string, any>;
const B = (id: string) => `/api/tutor/lop/${id}/bang-hoc-phi`;
const serverErrors: string[] = [];
/** `api` có đếm mọi phản hồi 5xx (không ca nào được phép làm máy chủ nổ, trừ ca cố ý gây lỗi DB gọi thẳng `api`). */
const A = async (method: string, path: string, o: { as?: TUser; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}) => {
  const r = await api(method, path, o);
  if (r.status >= 500) serverErrors.push(`${method} ${path} → ${r.status} ${r.text.slice(0, 120)}`);
  return r;
};
const getView = (cid: string, as?: TUser, ym?: string) => A("GET", `${B(cid)}${ym ? `?ym=${ym}` : ""}`, { as });
const prev = (cid: string, as: TUser | undefined, text: string, o: { ym?: string; pick?: Record<string, string> } = {}) =>
  A("POST", `${B(cid)}/nhap/xem-truoc`, { as, body: { ym: o.ym, text, ...(o.pick ? { pick: o.pick } : {}) } });
const conf = (cid: string, as: TUser | undefined, text: string, hash: string, o: { ym?: string; pick?: Record<string, string>; skipLines?: number[]; skipErrors?: boolean; extra?: Record<string, unknown> } = {}) =>
  A("POST", `${B(cid)}/nhap/xac-nhan`, { as, body: { ym: o.ym, text, fileHash: hash, ...(o.pick ? { pick: o.pick } : {}), ...(o.skipLines ? { skipLines: o.skipLines } : {}), ...(o.skipErrors ? { skipErrors: true } : {}), ...(o.extra ?? {}) } });
/** Xem trước rồi xác nhận ngay (đường đi thường của gia sư). */
async function importText(cid: string, as: TUser, text: string, o: { ym?: string; skipErrors?: boolean; pick?: Record<string, string> } = {}) {
  const p = await prev(cid, as, text, o);
  if (p.status !== 200) return { p, c: p };
  return { p, c: await conf(cid, as, text, p.json.fileHash, o) };
}
const putRow = (cid: string, sid: string, as: TUser | undefined, body: Record<string, unknown>) => A("PUT", `${B(cid)}/dong/${sid}`, { as, body });
const delRow = (cid: string, sid: string, as: TUser | undefined, ym?: string) => A("DELETE", `${B(cid)}/dong/${sid}${ym ? `?ym=${ym}` : ""}`, { as });
const putCfg = (cid: string, as: TUser | undefined, body: Record<string, unknown>) => A("PUT", `${B(cid)}/cau-hinh`, { as, body });
const issue = (as: TUser, ym: string, studentIds: string[]) => A("POST", "/api/tutor/invoices", { as, body: { yearMonth: ym, studentIds } });

async function multipart(path: string, as: TUser | undefined, fields: Record<string, string>, file?: { name: string; data: Uint8Array }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (file) fd.append("file", new Blob([file.data as BlobPart]), file.name);
  const headers: Record<string, string> = {};
  if (as) headers.cookie = await cookieFor(as);
  const res = await fetch(BASE + path, { method: "POST", headers, body: fd });
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  if (res.status >= 500) serverErrors.push(`POST ${path} (multipart ${file?.name}) → ${res.status} ${text.slice(0, 120)}`);
  return { status: res.status, json, text };
}
async function xlsxBuf(rows: unknown[][], sheet = "DS"): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet);
  rows.forEach(r => ws.addRow(r as never));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const counts = async () => JSON.stringify([
  await prisma.courseFeeTable.count(), await prisma.courseFeeSheetRow.count(), await prisma.feeCharge.count(),
  await prisma.auditLog.count(), await prisma.notification.count(), await prisma.tuitionInvoice.count(),
]);
const COUNT_LABEL = "course_fee_tables / course_fee_sheet_rows / fee_charges / audit_logs / notifications / tuition_invoices";

async function mkWorld(label: string, o: { startDay?: number; names?: string[]; tiers?: typeof TIERS } = {}) {
  const T = await mkTutor(`Cô ${label}`);
  const C = await mkCourse(T.id, { name: `Lớp bảng ${label}` });
  await prisma.course.update({ where: { id: C.id }, data: { feeMode: "monthly_sheet" } });
  await prisma.courseFeeTable.create({ data: { courseId: C.id, subjects: SUBJ, tiers: o.tiers ?? TIERS, periodStartDay: o.startDay ?? 1, updatedBy: T.id } });
  const S: Record<string, TUser> = {};
  for (const n of o.names ?? NAMES) { S[n] = await mkUser({ name: n }); await prisma.enrollment.create({ data: { userId: S[n].id, courseId: C.id, status: "active" } }); }
  return { T, C, S };
}
const rowOf = (cid: string, sid: string, ym = YM) => prisma.courseFeeSheetRow.findUnique({ where: { courseId_studentId_yearMonth: { courseId: cid, studentId: sid, yearMonth: ym } } });
const chargesOf = (where: object) => prisma.feeCharge.findMany({ where, orderBy: { createdAt: "asc" } });
const pvRow = (p: { json: any }, name: string) => (p.json.rows as any[]).find(r => r.name === name);

(async () => {
  await wipe();

  // ════════════════════════════════ 0. Ma trận quyền (hành động) ════════════════════════════════
  section("0. Ma trận quyền: money.edit (chủ lớp + quản trị) / không (đồng giảng, bộ môn, người ngoài)");
  check("canDo: owner & admin có money.edit và money.view", canDo("owner", "money.edit") && canDo("admin", "money.edit") && canDo("owner", "money.view") && canDo("admin", "money.view"));
  check("canDo: co_teacher / subject_teacher / none KHÔNG có money.edit lẫn money.view", (["co_teacher", "subject_teacher", "none"] as const).every(r => !canDo(r, "money.edit") && !canDo(r, "money.view")));

  // ════════════════════════════════ 1. QUYỀN trên cả 7 điểm vào ════════════════════════════════
  section("1. Quyền trên 7 điểm vào (chưa đăng nhập / học sinh / chờ duyệt / bị khoá / gia sư khác / bộ môn / đồng giảng / không có lớp)");
  const Q = await mkWorld("Q");
  const STU = await mkUser({ name: "Em Học Sinh" });
  const PEND = await mkUser({ name: "Cô Chờ Duyệt", role: "student" });
  await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });
  const BAN = await mkTutor("Cô Bị Khoá"); await prisma.user.update({ where: { id: BAN.id }, data: { banned: true } });
  const OTH = await mkTutor("Cô Lớp Khác");
  const OTHC = await mkCourse(OTH.id, { name: "Lớp của cô khác" });
  const SUB = await mkTutor("Thầy Bộ Môn"), CO = await mkTutor("Cô Đồng Giảng");
  await prisma.courseTeacher.create({ data: { courseId: Q.C.id, userId: SUB.id, role: "subject_teacher", status: "active", invitedBy: Q.T.id, subjects: ["Toán"] } });
  await prisma.courseTeacher.create({ data: { courseId: Q.C.id, userId: CO.id, role: "co_teacher", status: "active", invitedBy: Q.T.id, subjects: ["Sử"] } });
  const ADC = await mkUser({ name: "Quản Trị Nội Dung", role: "admin", adminRole: "admin_content" });
  const ADS = await mkSuper("Quản Trị Cấp 1");
  const q0 = await prev(Q.C.id, Q.T, FIVE_TEXT);
  const Q_HASH: string = q0.json.fileHash;
  const sidMai = Q.S["Mai Anh"].id;
  const EP = (cid: string, sid: string) => [
    { n: "GET /", f: (as?: TUser) => getView(cid, as) },
    { n: "PUT /cau-hinh", f: (as?: TUser) => putCfg(cid, as, { subjects: SUBJ, tiers: TIERS }) },
    { n: "GET /mau", f: (as?: TUser) => A("GET", `${B(cid)}/mau`, { as }) },
    { n: "POST /nhap/xem-truoc", f: (as?: TUser) => prev(cid, as, FIVE_TEXT) },
    { n: "POST /nhap/xac-nhan", f: (as?: TUser) => conf(cid, as, FIVE_TEXT, Q_HASH) },
    { n: "PUT /dong/<em>", f: (as?: TUser) => putRow(cid, sid, as, { sessions: { Toán: 8 } }) },
    { n: "DELETE /dong/<em>", f: (as?: TUser) => delRow(cid, sid, as) },
  ];
  const LEAK = /Lớp bảng|Mai Anh|Bảo Châu|Minh Khôi|Gia Hân|Tuấn Kiệt|\d{3}\.\d{3}|610000|1500000/;
  const denied: [string, TUser | undefined, number][] = [
    ["chưa đăng nhập", undefined, 401], ["học sinh", STU, 403], ["gia sư chờ duyệt (role student + đơn)", PEND, 403], ["gia sư bị khoá", BAN, 403],
    ["gia sư KHÁC (lớp không phải của mình)", OTH, 403], ["subject_teacher active", SUB, 403], ["co_teacher active", CO, 403],
  ];
  for (const [who, as, want] of denied) {
    const before = await counts();
    const outs = await Promise.all(EP(Q.C.id, sidMai).map(async e => ({ n: e.n, r: await e.f(as) })));
    check(`${who} → ${want} ở cả 7 điểm vào`, outs.every(o => o.r.status === want), outs.map(o => `${o.n}:${o.r.status}`));
    check(`${who}: thân lỗi không chứa tên lớp / tên em / số tiền`, outs.every(o => !LEAK.test(o.r.text)), outs.map(o => o.r.text.slice(0, 100)));
    check(`${who}: đếm 6 bảng KHÔNG đổi (${COUNT_LABEL})`, (await counts()) === before);
  }
  {
    const outs = await Promise.all(EP("khong-co-lop-nay", sidMai).map(async e => ({ n: e.n, r: await e.f(Q.T) })));
    check("lớp KHÔNG có → 404 ở cả 7 điểm vào (người đăng nhập là gia sư)", outs.every(o => o.r.status === 404), outs.map(o => `${o.n}:${o.r.status}`));
    const nul = await Promise.all(EP("%00", "%00").map(async e => ({ n: e.n, r: await e.f(Q.T) })));
    check("id lớp / id em chứa byte NUL → 404, không 500", nul.every(o => o.r.status === 404), nul.map(o => `${o.n}:${o.r.status}`));
    const adm = await Promise.all(EP("khong-co-lop-nay", sidMai).map(async e => ({ n: e.n, r: await e.f(ADC) })));
    check("lớp không có → 404 cả với quản trị (không lộ gì)", adm.every(o => o.r.status === 404));
  }
  {
    const before = await counts();
    const g = await getView(Q.C.id, Q.T), m = await A("GET", `${B(Q.C.id)}/mau`, { as: Q.T });
    check("chủ lớp: GET 200 và tải mẫu 200 (.xlsx, attachment ASCII, no-store)", g.status === 200 && m.status === 200 && /spreadsheetml/.test(m.headers.get("content-type") ?? "") && /^attachment; filename="hoc-phi-[A-Za-z0-9_-]+-\d{4}-\d{2}\.xlsx"$/.test(m.headers.get("content-disposition") ?? "") && /no-store/.test(m.headers.get("cache-control") ?? ""), { g: g.status, m: m.status, h: m.headers.get("content-disposition") });
    check("chủ lớp: xem trước 200, PUT dong dryRun 200 — và vẫn KHÔNG ghi gì", (await prev(Q.C.id, Q.T, FIVE_TEXT)).status === 200 && (await putRow(Q.C.id, sidMai, Q.T, { sessions: { Toán: 8 }, dryRun: true })).status === 200 && (await counts()) === before);
    const gv = await getView(Q.C.id, ADC), gs = await getView(Q.C.id, ADS);
    check("quản trị nội dung & cấp 1: GET 200 (thấy bảng, 0a #5)", gv.status === 200 && gs.status === 200 && gv.json.rows.length === 5);
  }
  const apiNames = await A("GET", `${B(Q.C.id)}`, { as: Q.T });
  check("GET của chủ không thấy dữ liệu của lớp người khác", !JSON.stringify(apiNames.json).includes("Lớp của cô khác"));

  // ── quản trị GHI (0a #5) ──
  section("1b. Quản trị ghi được (cau-hinh, mau, xem-truoc, xac-nhan, dong); AuditLog byRole + override; chủ lớp nhận ĐÚNG MỘT thông báo");
  const W = await mkWorld("QT");
  {
    const notes0 = await prisma.notification.count();
    const rc = await putCfg(W.C.id, ADC, { subjects: SUBJ, tiers: TIERS });
    check("admin_content PUT cau-hinh → 200, override=true", rc.status === 200 && rc.json.override === true && rc.json.enabled === false, rc.json);
    const mau = await A("GET", `${B(W.C.id)}/mau`, { as: ADC });
    check("admin_content tải mẫu → 200 (khác đặc tả gốc, theo 0a #5)", mau.status === 200);
    const preAud = await prisma.auditLog.count();
    const p = await prev(W.C.id, ADC, FIVE_TEXT);
    check("admin_content xem trước → 200, không audit mới, không thông báo", p.status === 200 && (await prisma.auditLog.count()) === preAud);
    const c = await conf(W.C.id, ADS, FIVE_TEXT, p.json.fileHash);
    check("admin_super xác nhận → 200, written 5, override=true", c.status === 200 && c.json.written === 5 && c.json.override === true, c.json);
    const pr = await putRow(W.C.id, W.S["Mai Anh"].id, ADC, { sessions: { Toán: 10, Anh: 4 }, freeSessions: 1, scholarship: 50000 });
    check("admin_content PUT dong → 200 applied", pr.status === 200 && pr.json.applied === true && pr.json.row.net === (13 * 60000 - 50000), pr.json.row);
    const dr = await delRow(W.C.id, W.S["Gia Hân"].id, ADS);
    check("admin_super DELETE dong → 200", dr.status === 200 && dr.json.deleted === true);
    const logs = await prisma.auditLog.findMany({ where: { resourceId: W.C.id, action: { startsWith: "fee_sheet." } }, orderBy: { createdAt: "asc" } });
    const meta = logs.map(l => l.metadata as any);
    check("AuditLog: đủ 3 loại (config, import, row), người thật là quản trị (không phải chủ lớp)", ["fee_sheet.config", "fee_sheet.import", "fee_sheet.row"].every(a => logs.some(l => l.action === a)) && logs.every(l => l.actorId === ADC.id || l.actorId === ADS.id), logs.map(l => l.action));
    check("AuditLog: byRole đúng vai (admin_content / admin_super) + override:true + ownerId = chủ lớp + preview:false", meta.every(m => m.override === true && m.ownerId === W.T.id && m.preview === false) && meta.some(m => m.byRole === "admin_content") && meta.some(m => m.byRole === "admin_super"), meta);
    const ch = await chargesOf({ courseId: W.C.id });
    check("FeeCharge.tutorId = chủ lớp (không phải quản trị)", ch.length >= 3 && ch.every(x => x.tutorId === W.T.id), ch.map(x => x.tutorId));
    const ns = await prisma.notification.findMany({ where: { type: "course_fee_override" } });
    check("chủ lớp nhận ĐÚNG MỘT Notification course_fee_override sau 4 lần quản trị ghi (chống dội theo type+link chưa đọc)", ns.length === 1 && ns[0].userId === W.T.id && ns[0].link === `/lop-cua-toi/${W.C.id}?tab=hoc-phi` && !ns[0].isRead, ns);
    check("thông báo không có tên học sinh / tên lớp / chữ số", ns.length > 0 && !/Mai Anh|Bảo Châu|Minh Khôi|Gia Hân|Tuấn Kiệt|Lớp bảng/.test(ns[0].title + ns[0].message) && !/\d/.test(ns[0].title + ns[0].message), ns[0]);
    check("quản trị không nhận thông báo nào; tổng thông báo mới = 1", (await prisma.notification.count({ where: { userId: { in: [ADC.id, ADS.id] } } })) === 0 && (await prisma.notification.count()) === notes0 + 1);
    await prisma.notification.updateMany({ where: { userId: W.T.id }, data: { isRead: true } });
    await putRow(W.C.id, W.S["Bảo Châu"].id, ADC, { sessions: { Toán: 8, Sử: 8, Địa: 8, Anh: 8 }, discount: 200000 });
    check("chủ đã ĐỌC thông báo → quản trị ghi tiếp thì có thông báo thứ hai (không nuốt mất)", (await prisma.notification.count({ where: { type: "course_fee_override" } })) === 2);
    const n2 = await prisma.notification.count();
    await putRow(W.C.id, W.S["Minh Khôi"].id, W.T, { sessions: { Toán: 6 } });
    await delRow(W.C.id, W.S["Minh Khôi"].id, W.T);
    check("CHỦ LỚP tự ghi → 0 thông báo mới", (await prisma.notification.count()) === n2);
    const own = await prisma.auditLog.findMany({ where: { actorId: W.T.id, action: { startsWith: "fee_sheet." } } });
    check("AuditLog của chủ tự ghi: byRole teacher, override:false", own.length === 2 && own.every(l => (l.metadata as any).byRole === "teacher" && (l.metadata as any).override === false), own.map(l => l.metadata));
  }
  {
    const before = await counts();
    const r = await putCfg(Q.C.id, SUB, { subjects: SUBJ, tiers: [{ subjects: 1, rate: 1000 }] });
    const r2 = await putRow(Q.C.id, sidMai, CO, { sessions: { Toán: 99 }, scholarship: 1 });
    check("bộ môn / đồng giảng gửi thân HỢP LỆ vẫn 403 và không ghi gì", r.status === 403 && r2.status === 403 && (await counts()) === before);
  }

  // ════════════════════════════════ 2. Xem trước KHÔNG ghi ════════════════════════════════
  section("2. Xem trước không ghi gì (6 bảng + audit + thông báo), kể cả tệp toàn dòng sai");
  const M = await mkWorld("M");
  const bad = tsv([{ "Họ tên": "Mai Anh", Toán: "70k", "Học bổng": "-5" }, { "Họ tên": "Bảo Châu", Toán: 99 }, { "Họ tên": "Người Lạ", Toán: 1 }]);
  {
    const before = await counts();
    const p = await prev(M.C.id, M.T, FIVE_TEXT);
    const pb = await prev(M.C.id, M.T, bad);
    const p0 = await prev(M.C.id, M.T, tsv([]));
    check("xem trước tệp tốt: 200, không ghi gì", p.status === 200 && p.json.writable === 5 && (await counts()) === before);
    check("xem trước tệp TOÀN DÒNG SAI: 200, 0 dòng ghi được, không ghi gì", pb.status === 200 && pb.json.writable === 0 && pb.json.counts.error + pb.json.counts.unmatched === 3 && (await counts()) === before, pb.json.counts);
    check("xem trước tệp chỉ có tiêu đề: fatal, không ghi gì", p0.status === 200 && !!p0.json.fatal && p0.json.writable === 0 && (await counts()) === before, p0.json.fatal);
  }

  // ════════════════════════════════ 3. Xác nhận đúng số ════════════════════════════════
  section("3. Xác nhận ghi đúng số tay tính 610.000 / 1.500.000 / 360.000 / 660.000 / 0 (tổng 3.130.000)");
  let hash = "";
  {
    const p = await prev(M.C.id, M.T, FIVE_TEXT);
    hash = p.json.fileHash;
    const f = (n: string) => pvRow(p, n);
    check("xem trước: Phải đóng từng em đúng số tay tính", NAMES.every(n => f(n)?.net === NET[n]), p.json.rows.map((r: any) => [r.name, r.net]));
    check("xem trước: 4 dòng ok + 1 dòng warn (Tuấn Kiệt Phải đóng 0đ), writable 5, tổng 3.130.000", p.json.counts.ok === 4 && p.json.counts.warn === 1 && f("Tuấn Kiệt").status === "warn" && p.json.writable === 5 && p.json.totalNet === TOTAL, p.json.counts);
    check("xem trước: Mai Anh k=2 'counted' bậc 60.000, 11 buổi, gốc 660.000; Gia Hân k=3 'file' bậc 55.000; Minh Khôi giá riêng 45.000 thắng bậc 70.000",
      f("Mai Anh").subjectCount === 2 && f("Mai Anh").subjectCountSource === "counted" && f("Mai Anh").tierRate === 60000 && f("Mai Anh").billable === 11 && f("Mai Anh").gross === 660000
      && f("Gia Hân").subjectCount === 3 && f("Gia Hân").subjectCountSource === "file" && f("Gia Hân").tierRate === 55000
      && f("Minh Khôi").unitRate === 45000 && f("Minh Khôi").tierRate === 70000 && f("Minh Khôi").subjectCountSource === "counted");
    check("xem trước: khớp theo tên (matchedBy name) và trả studentId đúng em", NAMES.every(n => f(n).matchedBy === "name" && f(n).studentId === M.S[n].id));

    const noMoney = await counts();
    // số khách gửi lên bị bỏ qua: gửi net / totalNet / rows giả
    const c = await conf(M.C.id, M.T, FIVE_TEXT, hash, { extra: { net: 1, totalNet: 1, rows: [{ line: 2, net: 1, gross: 1, unitRate: 1 }], gross: 1, written: 999 } });
    check("xác nhận → 200 written 5, chargesCreated 4, totalNet 3.130.000 (số khách gửi lên bị BỎ QUA)", c.status === 200 && c.json.ok === true && c.json.written === 5 && c.json.chargesCreated === 4 && c.json.totalNet === TOTAL && c.json.override === false, c.json);
    const rows = await prisma.courseFeeSheetRow.findMany({ where: { courseId: M.C.id } });
    const rm = (n: string) => rows.find(r => r.studentId === M.S[n].id)!;
    check("DB: 5 dòng CourseFeeSheetRow, net đúng từng em", rows.length === 5 && NAMES.every(n => rm(n).net === NET[n]) && rows.every(r => r.yearMonth === YM), rows.map(r => r.net));
    check("DB: Mai Anh chụp đủ đầu vào + số tính (bậc 60.000, 11 buổi, miễn 1, học bổng 50.000, source 'paste', counted)", rm("Mai Anh").tierRate === 60000 && rm("Mai Anh").unitRate === 60000 && rm("Mai Anh").billable === 11 && rm("Mai Anh").gross === 660000 && rm("Mai Anh").freeSessions === 1 && rm("Mai Anh").scholarship === 50000 && rm("Mai Anh").source === "paste" && rm("Mai Anh").subjectCountSource === "counted" && stableStringify(rm("Mai Anh").sessions) === stableStringify({ Anh: 4, Toán: 8 }), rm("Mai Anh"));
    check("DB: Gia Hân 'file' k=3, Minh Khôi rateOverride 45.000", rm("Gia Hân").subjectCountSource === "file" && rm("Gia Hân").subjectCount === 3 && rm("Minh Khôi").rateOverride === 45000 && rm("Minh Khôi").unitRate === 45000);
    const ch = await chargesOf({ courseId: M.C.id });
    const chOf = (n: string) => ch.find(x => x.studentId === M.S[n].id);
    check("DB: đúng 4 FeeCharge kind 'sheet' (net = 0 KHÔNG tạo): 610.000 / 1.500.000 / 360.000 / 660.000", ch.length === 4 && ch.every(x => x.kind === "sheet" && x.mode === "monthly_sheet") && chOf("Tuấn Kiệt") === undefined && NAMES.filter(n => n !== "Tuấn Kiệt").every(n => chOf(n)?.amount === NET[n]), ch.map(x => [x.studentId, x.amount]));
    check("DB: FeeCharge chưa vào phiếu, tutorId = chủ lớp, dateKey '<ym>-01', yearMonth, recordId null, rateSource", ch.every(x => x.invoiceId === null && x.tutorId === M.T.id && x.dateKey === `${YM}-01` && x.yearMonth === YM && x.recordId === null) && chOf("Minh Khôi")!.rateSource === "student" && chOf("Mai Anh")!.rateSource === "class" && chOf("Mai Anh")!.rate === 60000);
    check("DB: nhãn dòng phí 'Học phí MM/YYYY · 2 môn · 11 buổi · đã trừ học bổng/giảm trừ'; Minh Khôi (không trừ) không có đuôi", chOf("Mai Anh")!.label === `Học phí ${LABEL(YM)} · 2 môn · 11 buổi · đã trừ học bổng/giảm trừ` && chOf("Minh Khôi")!.label === `Học phí ${LABEL(YM)} · 1 môn · 8 buổi`, ch.map(x => x.label));
    check("DB: dòng của Tuấn Kiệt có feeChargeId null; các dòng khác trỏ đúng FeeCharge", rm("Tuấn Kiệt").feeChargeId === null && NAMES.filter(n => n !== "Tuấn Kiệt").every(n => rm(n).feeChargeId === chOf(n)!.id));
    void noMoney;

    // bấm hai lần
    const upd = await prisma.courseFeeSheetRow.findMany({ where: { courseId: M.C.id }, select: { id: true, updatedAt: true } });
    const p2 = await prev(M.C.id, M.T, FIVE_TEXT);
    check("xem trước lần hai: cả 5 dòng 'unchanged'", p2.json.counts.unchanged === 5 && p2.json.writable === 0, p2.json.counts);
    const c2 = await conf(M.C.id, M.T, FIVE_TEXT, p2.json.fileHash);
    const upd2 = await prisma.courseFeeSheetRow.findMany({ where: { courseId: M.C.id }, select: { id: true, updatedAt: true } });
    check("bấm xác nhận lần hai → written 0, không dòng thứ hai, không dòng nào bị ghi lại (updatedAt giữ nguyên)", c2.status === 200 && c2.json.written === 0 && c2.json.unchanged === 5 && (await prisma.courseFeeSheetRow.count({ where: { courseId: M.C.id } })) === 5 && (await prisma.feeCharge.count({ where: { courseId: M.C.id } })) === 4 && JSON.stringify(upd) === JSON.stringify(upd2));
    // FILE_CHANGED
    const changed = tsv([{ ...FIVE[0], Toán: 9 }, ...FIVE.slice(1)]); // Mai Anh Toán 8 → 9 (các ô giữa có ô trống nên không thay chuỗi con được)
    const before = await counts();
    const cf = await conf(M.C.id, M.T, changed, hash);
    check("đổi tệp giữa xem trước và xác nhận → 409 FILE_CHANGED, không ghi gì", cf.status === 409 && cf.json.code === "FILE_CHANGED" && (await counts()) === before, cf.json);
    const nh = await A("POST", `${B(M.C.id)}/nhap/xac-nhan`, { as: M.T, body: { ym: YM, text: FIVE_TEXT } });
    check("thiếu fileHash → 400 NO_HASH (không xác nhận khi chưa xem trước)", nh.status === 400 && nh.json.code === "NO_HASH");
    // đổi kỳ giữa chừng cũng làm băm lệch
    const cym = await conf(M.C.id, M.T, FIVE_TEXT, hash, { ym: YM_PREV });
    check("đổi KỲ giữa xem trước và xác nhận → 409 FILE_CHANGED", cym.status === 409 && cym.json.code === "FILE_CHANGED");

    // replace: Mai Anh Toán 8 → 9: 12 buổi × 60.000 − 50.000 = 670.000; Minh Khôi → net 0; Tuấn Kiệt → net 280.000
    const t2 = tsv([
      { "Họ tên": "Mai Anh", Toán: 9, Anh: 4, "Buổi miễn phí": 1, "Học bổng": 50000 },
      { "Họ tên": "Minh Khôi", Toán: 8, "Đơn giá riêng": 45000, "Học bổng": 400000 },
      { "Họ tên": "Tuấn Kiệt", Anh: 4 },
    ]);
    const ids0 = Object.fromEntries((await chargesOf({ courseId: M.C.id })).map(x => [x.studentId, x.id]));
    const bcRow = (await rowOf(M.C.id, M.S["Bảo Châu"].id))!;
    const pr = await prev(M.C.id, M.T, t2);
    check("xem trước dòng đã có số khác → 'replace' kèm before (610.000 → 670.000); Minh Khôi về 0 'replace'; Tuấn Kiệt 0 → 280.000 'replace'", pvRow(pr, "Mai Anh").status === "replace" && pvRow(pr, "Mai Anh").before.net === 610000 && pvRow(pr, "Mai Anh").net === 670000 && pvRow(pr, "Minh Khôi").net === 0 && pvRow(pr, "Tuấn Kiệt").net === 280000, pr.json.rows.map((r: any) => [r.name, r.status, r.net]));
    const cr = await conf(M.C.id, M.T, t2, pr.json.fileHash);
    const ch2 = await chargesOf({ courseId: M.C.id });
    check("xác nhận sửa: replaced 3, cập nhật FeeCharge TẠI CHỖ (cùng id), gỡ phí của em về 0, tạo phí cho em từ 0", cr.json.written === 3 && cr.json.replaced === 3 && cr.json.chargesUpdated === 1 && cr.json.chargesRemoved === 1 && cr.json.chargesCreated === 1
      && ch2.find(x => x.studentId === M.S["Mai Anh"].id)!.id === ids0[M.S["Mai Anh"].id] && ch2.find(x => x.studentId === M.S["Mai Anh"].id)!.amount === 670000
      && !ch2.some(x => x.studentId === M.S["Minh Khôi"].id) && ch2.find(x => x.studentId === M.S["Tuấn Kiệt"].id)!.amount === 280000 && ch2.length === 4, cr.json);
    check("dòng em không có trong tệp (Bảo Châu, Gia Hân) giữ nguyên byte, không bị đụng", JSON.stringify(await rowOf(M.C.id, M.S["Bảo Châu"].id)) === JSON.stringify(bcRow) && pr.json.rosterNotInFile.map((x: any) => x.name).sort().join() === "Bảo Châu,Gia Hân");
    // lập lại để các mục sau dùng số ban đầu
    const back = await importText(M.C.id, M.T, FIVE_TEXT);
    check("nhập lại tệp gốc → trở về số ban đầu (Mai Anh 610.000, Minh Khôi 360.000, Tuấn Kiệt 0, không FeeCharge thừa)", back.c.status === 200 && (await prisma.feeCharge.count({ where: { courseId: M.C.id } })) === 4 && (await rowOf(M.C.id, M.S["Tuấn Kiệt"].id))!.net === 0 && (await chargesOf({ studentId: M.S["Tuấn Kiệt"].id })).length === 0, back.c.json);
  }

  // ════════════════════════════════ 3b. GET bảng + sửa tay + subjectCountSource ════════════════════════════════
  section("3b. GET bảng tháng, sửa tay một em (dryRun / ghi / xoá), subjectCountSource file vs counted ở xem trước, GET, PUT dryRun, DB");
  {
    const g = await getView(M.C.id, M.T);
    const gr = (n: string) => (g.json.rows as any[]).find(r => r.name === n);
    check("GET: feeMode monthly_sheet, yearMonth hiện tại, cấu hình 4 bậc + 4 môn, 5 dòng filled, tổng 3.130.000", g.status === 200 && g.json.feeMode === "monthly_sheet" && g.json.yearMonth === YM && g.json.config.subjects.join() === SUBJ.join() && g.json.config.tiers.length === 4 && g.json.rows.length === 5 && g.json.totals.filled === 5 && g.json.totals.unfilled === 0 && g.json.totals.net === TOTAL, g.json.totals);
    check("GET: mỗi dòng có net đúng, locked false, invoice null", NAMES.every(n => gr(n).net === NET[n] && gr(n).locked === false && gr(n).invoice === null));
    check("GET: subjectCountSource — Gia Hân 'file', Mai Anh 'counted'", gr("Gia Hân").subjectCountSource === "file" && gr("Mai Anh").subjectCountSource === "counted");
    const g2 = await getView(M.C.id, M.T, YM_PREV);
    check("GET kỳ trước chưa nhập: 5 dòng filled:false, các số null, tổng 0", g2.json.rows.length === 5 && g2.json.rows.every((r: any) => r.filled === false && r.net === null) && g2.json.totals.net === 0 && g2.json.totals.unfilled === 5);
    check("GET ym sai → 400 (2026-13, 2026-1, 'abc', quá 12 tháng trước / sau)", (await Promise.all(["2026-13", "2026-1", "abc", shiftYm(YM, -13), shiftYm(YM, 13)].map(y => getView(M.C.id, M.T, y)))).every(r => r.status === 400));
    check("GET ym biên (±12 kỳ) → 200", (await getView(M.C.id, M.T, shiftYm(YM, -12))).status === 200 && (await getView(M.C.id, M.T, shiftYm(YM, 12))).status === 200);

    const gh = M.S["Gia Hân"].id;
    const body = { sessions: { Toán: 6, Sử: 6 }, freeSessions: 0 };
    const d1 = await putRow(M.C.id, gh, M.T, { ...body, subjectCount: null, dryRun: true });
    const d2 = await putRow(M.C.id, gh, M.T, { ...body, subjectCount: 3, dryRun: true });
    check("PUT dryRun: subjectCount null → 'counted' k=2 bậc 60.000 → 720.000; subjectCount 3 → 'file' bậc 55.000 → 660.000; dryRun không ghi", d1.json.row.subjectCountSource === "counted" && d1.json.row.net === 720000 && d2.json.row.subjectCountSource === "file" && d2.json.row.net === 660000 && d1.json.applied === false && (await rowOf(M.C.id, gh))!.net === 660000);
    const w1 = await putRow(M.C.id, gh, M.T, { ...body, subjectCount: null });
    const dbA = (await rowOf(M.C.id, gh))!, chA = await chargesOf({ studentId: gh });
    check("PUT ghi 'counted': DB subjectCountSource 'counted', source 'manual', net 720.000, FeeCharge cập nhật (không tạo thứ hai)", w1.json.applied === true && dbA.subjectCountSource === "counted" && dbA.source === "manual" && dbA.net === 720000 && chA.length === 1 && chA[0].amount === 720000);
    const w0 = await putRow(M.C.id, gh, M.T, { ...body, subjectCount: null });
    check("PUT giống hệt lần trước → unchanged, không ghi lại", w0.json.unchanged === true && w0.json.applied === false);
    await putRow(M.C.id, gh, M.T, { ...body, subjectCount: 3 });
    check("PUT lại với số môn ghi tay → DB trở về 'file' 660.000", (await rowOf(M.C.id, gh))!.subjectCountSource === "file" && (await rowOf(M.C.id, gh))!.net === 660000);
    const bads: [string, Record<string, unknown>][] = [
      ["sessions không phải đối tượng", { sessions: "Toán" }], ["số buổi là chữ", { sessions: { Toán: "8" } }], ["môn lạ", { sessions: { Hoá: 3 } }], ["buổi > 60", { sessions: { Toán: 61 } }],
      ["buổi âm", { sessions: { Toán: -1 } }], ["miễn > tổng", { sessions: { Toán: 2 }, freeSessions: 3 }], ["miễn là chữ", { sessions: { Toán: 2 }, freeSessions: "1" }],
      ["đơn giá riêng 999", { sessions: { Toán: 2 }, rateOverride: 999 }], ["đơn giá riêng 0", { sessions: { Toán: 2 }, rateOverride: 0 }], ["số môn < số môn có buổi", { sessions: { Toán: 1, Sử: 1, Địa: 1 }, subjectCount: 2 }],
      ["học bổng âm", { sessions: { Toán: 2 }, scholarship: -1 }], ["giảm trừ thập phân", { sessions: { Toán: 2 }, discount: 0.5 }], ["ghi chú > 300 ký tự", { sessions: { Toán: 2 }, note: "x".repeat(301) }],
      ["ghi chú là số", { sessions: { Toán: 2 }, note: 5 }], ["dryRun sai kiểu", { sessions: { Toán: 2 }, dryRun: "yes" }], ["yearMonth sai kiểu", { sessions: { Toán: 2 }, yearMonth: 202611 }],
      ["yearMonth quá 12 kỳ", { sessions: { Toán: 2 }, yearMonth: shiftYm(YM, -14) }],
    ];
    const before = await counts();
    const outs = await Promise.all(bads.map(async ([n, b]) => ({ n, r: await putRow(M.C.id, M.S["Minh Khôi"].id, M.T, b) })));
    check("PUT dong với 17 thân sai → toàn 400 (không 500), không ghi gì", outs.every(o => o.r.status === 400) && (await counts()) === before, outs.filter(o => o.r.status !== 400).map(o => [o.n, o.r.status]));
    check("PUT dong thân không phải JSON object (mảng / chuỗi / null / rỗng) → 400", (await Promise.all([[], "x", null].map(b => A("PUT", `${B(M.C.id)}/dong/${gh}`, { as: M.T, body: b })))).every(r => r.status === 400) && (await A("PUT", `${B(M.C.id)}/dong/${gh}`, { as: M.T, raw: "{không phải json", headers: { "content-type": "application/json" } })).status === 400);
    const del = await delRow(M.C.id, gh, M.T);
    check("DELETE dong: 200, gỡ dòng + FeeCharge", del.status === 200 && del.json.chargeRemoved === true && (await rowOf(M.C.id, gh)) === null && (await chargesOf({ studentId: gh })).length === 0);
    check("DELETE lần hai → 404 ROW_NOT_FOUND; ym sai → 400", (await delRow(M.C.id, gh, M.T)).status === 404 && (await delRow(M.C.id, gh, M.T, "xx")).status === 400);
    await putRow(M.C.id, gh, M.T, { ...body, subjectCount: 3, note: "SĐT phụ huynh 0912345678, Gia Hân" });
  }

  // ════════════════════════════════ 4. Bật chế độ + cấu hình ════════════════════════════════
  section("4. Bật chế độ: lớp có tiền → 409 HAS_MONEY_HISTORY; lớp mới → monthly_sheet + CourseFeeTable một giao dịch; kiểm tra cấu hình");
  const E = await mkTutor("Cô Bật Chế Độ");
  const COURSE_BASE = { category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null, bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true };
  let courseSeq = 0;
  const createCourse = async (as: TUser, extra: Record<string, unknown> = {}) => { courseSeq++; const id = `hpl-${Date.now().toString(36)}-${courseSeq}`; return { id, res: await A("POST", "/api/courses", { as, body: { ...COURSE_BASE, id, name: `Lớp ${courseSeq}`, adminName: `Lớp ${courseSeq}`, shortTitle: `L${courseSeq}`, ...extra } }) }; };
  {
    const old = await mkCourse(E.id, { name: "Lớp cũ có FeeCharge" });
    const stu = await mkUser({ name: "Em Cũ" }); await prisma.enrollment.create({ data: { userId: stu.id, courseId: old.id, status: "active" } });
    await prisma.feeCharge.create({ data: { tutorId: E.id, courseId: old.id, studentId: stu.id, kind: "extra", dateKey: `${YM}-05`, yearMonth: YM, amount: 50000, mode: "per_session", label: "Tài liệu" } });
    const r = await putCfg(old.id, E, { subjects: SUBJ, tiers: TIERS, enable: true });
    check("enable trên lớp có FeeCharge → 409 HAS_MONEY_HISTORY (số đếm, không tên), feeMode giữ nguyên, không CourseFeeTable", r.status === 409 && r.json.code === "HAS_MONEY_HISTORY" && r.json.feeCharges === 1 && r.json.monthlyFees === 0 && (await prisma.course.findUniqueOrThrow({ where: { id: old.id } })).feeMode === "monthly_sessions" && (await prisma.courseFeeTable.count({ where: { courseId: old.id } })) === 0, r.json);
    const old2 = await mkCourse(E.id, { name: "Lớp cũ có MonthlyCourseFee" });
    await prisma.monthlyCourseFee.create({ data: { courseId: old2.id, yearMonth: YM, sessionCount: 8, updatedBy: E.id } });
    const r2 = await putCfg(old2.id, E, { subjects: SUBJ, tiers: TIERS, enable: true });
    check("enable trên lớp có MonthlyCourseFee → 409 HAS_MONEY_HISTORY, feeMode giữ nguyên", r2.status === 409 && r2.json.code === "HAS_MONEY_HISTORY" && r2.json.monthlyFees === 1 && (await prisma.course.findUniqueOrThrow({ where: { id: old2.id } })).feeMode === "monthly_sessions");
    const ng = await putCfg(old.id, E, { subjects: SUBJ, tiers: TIERS });
    check("lớp cách cũ không bật enable → 409 NOT_SHEET_MODE (không tự đổi cách tính)", ng.status === 409 && ng.json.code === "NOT_SHEET_MODE" && (await prisma.course.findUniqueOrThrow({ where: { id: old.id } })).feeMode === "monthly_sessions");
    for (const [n, a] of [["GET /mau", () => A("GET", `${B(old.id)}/mau`, { as: E })], ["xem-truoc", () => prev(old.id, E, FIVE_TEXT)], ["PUT dong", () => putRow(old.id, stu.id, E, { sessions: { Toán: 1 } })]] as const) {
      const x = await a(); check(`lớp cách cũ: ${n} → 409 NOT_SHEET_MODE`, x.status === 409 && x.json.code === "NOT_SHEET_MODE", x.json);
    }
    const gOld = await getView(old.id, E);
    check("GET lớp cách cũ → 409 NOT_SHEET_MODE + canEnable false (đã có tiền)", gOld.status === 409 && gOld.json.canEnable === false);

    // trigger gây lỗi giữa chừng: tạo CourseFeeTable thất bại thì feeMode phải quay lại
    const fresh = await mkCourse(E.id, { name: "Lớp mới tinh" });
    const gFresh = await getView(fresh.id, E);
    check("GET lớp mới tinh (chưa có tiền) → 409 NOT_SHEET_MODE nhưng canEnable true", gFresh.status === 409 && gFresh.json.canEnable === true && gFresh.json.suggestedConfig === null, gFresh.json);
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION hpl_boom() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'hpl-boom'; END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER hpl_boom_t BEFORE INSERT ON course_fee_tables FOR EACH ROW EXECUTE FUNCTION hpl_boom()`);
    let boom;
    try { boom = await api("PUT", `${B(fresh.id)}/cau-hinh`, { as: E, body: { subjects: SUBJ, tiers: TIERS, enable: true } }); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS hpl_boom_t ON course_fee_tables`); await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS hpl_boom()`); }
    check("lỗi GIỮA CHỪNG (tạo CourseFeeTable thất bại) → không đổi gì: feeMode vẫn cách cũ, không CourseFeeTable (một giao dịch)", boom!.status >= 500 && (await prisma.course.findUniqueOrThrow({ where: { id: fresh.id } })).feeMode === "monthly_sessions" && (await prisma.courseFeeTable.count({ where: { courseId: fresh.id } })) === 0, boom);

    // suggestedConfig từ lớp monthly_sheet gần nhất của cùng gia sư
    const first = await mkCourse(E.id, { name: "Lớp bảng đầu của cô" });
    await prisma.course.update({ where: { id: first.id }, data: { feeMode: "monthly_sheet" } });
    await prisma.courseFeeTable.create({ data: { courseId: first.id, subjects: ["Lý", "Hoá"], tiers: [{ subjects: 1, rate: 90000 }, { subjects: 2, rate: 80000 }], periodStartDay: 15, updatedBy: E.id } });
    const gS = await getView(fresh.id, E);
    check("GET lớp mới: suggestedConfig = bảng của lớp monthly_sheet GẦN NHẤT của cùng gia sư (0a #7: điền sẵn, sửa được)", gS.json.suggestedConfig?.subjects.join() === "Lý,Hoá" && gS.json.suggestedConfig?.tiers[0].rate === 90000 && gS.json.suggestedConfig?.periodStartDay === 15, gS.json.suggestedConfig);
    const gOther = await getView((await mkCourse(OTH.id, { name: "Lớp mới của cô khác" })).id, OTH);
    check("suggestedConfig KHÔNG lấy từ lớp của gia sư khác", gOther.json.suggestedConfig === null, gOther.json.suggestedConfig);

    const cfgBad: [string, Record<string, unknown>][] = [
      ["subjects rỗng", { subjects: [], tiers: TIERS, enable: true }], ["7 môn", { subjects: ["a", "b", "c", "d", "e", "f", "g"], tiers: TIERS, enable: true }], ["môn trùng sau bỏ dấu", { subjects: ["Toán", "toan"], tiers: TIERS, enable: true }],
      ["tên môn 41 ký tự", { subjects: ["x".repeat(41)], tiers: TIERS, enable: true }], ["môn không phải chữ", { subjects: [5], tiers: TIERS, enable: true }], ["subjects không phải mảng", { subjects: "Toán", tiers: TIERS, enable: true }],
      ["bậc đầu không phải 1 môn", { subjects: SUBJ, tiers: [{ subjects: 2, rate: 60000 }], enable: true }], ["bậc không tăng", { subjects: SUBJ, tiers: [{ subjects: 1, rate: 70000 }, { subjects: 1, rate: 60000 }], enable: true }],
      ["đơn giá 999", { subjects: SUBJ, tiers: [{ subjects: 1, rate: 999 }], enable: true }], ["đơn giá lẻ", { subjects: SUBJ, tiers: [{ subjects: 1, rate: 70000.5 }], enable: true }], ["9 bậc", { subjects: SUBJ, tiers: Array.from({ length: 9 }, (_, i) => ({ subjects: i + 1, rate: 50000 })), enable: true }],
      ["tiers là đối tượng", { subjects: SUBJ, tiers: {}, enable: true }], ["enable sai kiểu", { subjects: SUBJ, tiers: TIERS, enable: "true" }], ["periodStartDay 0", { subjects: SUBJ, tiers: TIERS, enable: true, periodStartDay: 0 }],
      ["periodStartDay 29", { subjects: SUBJ, tiers: TIERS, enable: true, periodStartDay: 29 }], ["periodStartDay 1,5", { subjects: SUBJ, tiers: TIERS, enable: true, periodStartDay: 1.5 }], ["periodStartDay 'a'", { subjects: SUBJ, tiers: TIERS, enable: true, periodStartDay: "a" }],
      ["periodStartDay -1", { subjects: SUBJ, tiers: TIERS, enable: true, periodStartDay: -1 }],
    ];
    const bb = await counts();
    const outs = await Promise.all(cfgBad.map(async ([n, b]) => ({ n, r: await putCfg(fresh.id, E, b) })));
    check("PUT cau-hinh với 20 thân sai (kể cả periodStartDay 0 / 29 / 1,5 / 'a') → toàn 400, lớp vẫn cách cũ, không CourseFeeTable", outs.every(o => o.r.status === 400) && (await counts()) === bb && (await prisma.course.findUniqueOrThrow({ where: { id: fresh.id } })).feeMode === "monthly_sessions", outs.filter(o => o.r.status !== 400).map(o => [o.n, o.r.status]));
    check("PUT cau-hinh thân không phải JSON object → 400 (không 500)", (await Promise.all([[], "x", null].map(b => A("PUT", `${B(fresh.id)}/cau-hinh`, { as: E, body: b })))).every(r => r.status === 400) && (await A("PUT", `${B(fresh.id)}/cau-hinh`, { as: E, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);

    const ok = await putCfg(fresh.id, E, { subjects: ["Toán", "Anh"], tiers: [{ subjects: 1, rate: 80000 }, { subjects: 2, rate: 70000 }], enable: true, periodStartDay: 10 });
    const cDb = await prisma.course.findUniqueOrThrow({ where: { id: fresh.id } });
    const tDb = await prisma.courseFeeTable.findUnique({ where: { courseId: fresh.id } });
    check("enable lớp mới tinh → 200: Course.feeMode 'monthly_sheet' + CourseFeeTable (môn, bậc, ngày bắt đầu kỳ 10) trong MỘT giao dịch", ok.status === 200 && ok.json.enabled === true && cDb.feeMode === "monthly_sheet" && tDb?.subjects.join() === "Toán,Anh" && tDb.periodStartDay === 10 && stableStringify(tDb.tiers) === stableStringify([{ subjects: 1, rate: 80000 }, { subjects: 2, rate: 70000 }]), { ok: ok.json, cDb: cDb.feeMode });
    const lg = await prisma.auditLog.findFirst({ where: { action: "fee_sheet.config", resourceId: fresh.id } });
    check("AuditLog fee_sheet.config: enabled true, previousFeeMode 'monthly_sessions', không tên người / số tiền riêng", (lg?.metadata as any)?.enabled === true && (lg?.metadata as any)?.previousFeeMode === "monthly_sessions" && !/rate|amount|name/i.test(JSON.stringify(Object.keys(lg?.metadata as object))));
    check("không có đường quay lại: sau khi bật, lớp là monthly_sheet và PUT cau-hinh (không enable) sửa được bảng", (await putCfg(fresh.id, E, { subjects: ["Toán", "Anh", "Sử"], tiers: [{ subjects: 1, rate: 85000 }] })).status === 200 && (await prisma.courseFeeTable.findUniqueOrThrow({ where: { courseId: fresh.id } })).subjects.length === 3);

    // POST /api/courses
    const c1 = await createCourse(E, { feeMode: "monthly_sheet" });
    const c1db = await prisma.course.findUniqueOrThrow({ where: { id: c1.id } });
    check("POST /api/courses feeMode 'monthly_sheet' KHÔNG cần feeRate → 201, feeMode đúng, 0 CourseFeeRate, 0 CourseFeeTable (đặt bậc sau ở tab Học phí)", c1.res.status === 201 && c1db.feeMode === "monthly_sheet" && (await prisma.courseFeeRate.count({ where: { courseId: c1.id } })) === 0 && (await prisma.courseFeeTable.count({ where: { courseId: c1.id } })) === 0, c1.res.json);
    const c2 = await createCourse(E, { feeMode: "monthly_sheet", feeRate: 150000 });
    check("POST /api/courses monthly_sheet kèm feeRate thừa → vẫn 201 và KHÔNG tạo CourseFeeRate", c2.res.status === 201 && (await prisma.courseFeeRate.count({ where: { courseId: c2.id } })) === 0);
    const c3 = await createCourse(E, { feeMode: "per_session", feeRate: 150000 });
    check("[số cũ] POST /api/courses theo buổi vẫn tạo CourseFeeRate 150.000", c3.res.status === 201 && (await prisma.courseFeeRate.findFirstOrThrow({ where: { courseId: c3.id } })).rate === 150000);
    check("[số cũ] feeMode lạ vẫn 400, lớp không được tạo", (await createCourse(E, { feeMode: "monthly_sheets" })).res.status === 400);
    const cg = await getView(c1.id, E);
    check("lớp tạo bằng POST /api/courses (chưa có bảng bậc): GET 200 config null, rows rỗng nhưng có em, canEnable", cg.status === 200 && cg.json.config === null && cg.json.feeMode === "monthly_sheet");
    const noTable = await prev(c1.id, E, FIVE_TEXT);
    check("lớp chưa có bảng bậc: xem trước / mẫu → 409 NO_TABLE", noTable.status === 409 && noTable.json.code === "NO_TABLE" && (await A("GET", `${B(c1.id)}/mau`, { as: E })).json.code === "NO_TABLE");
    // fee-rates
    const fr = await A("POST", `/api/courses/${c1.id}/fee-rates`, { as: E, body: { action: "set_class", rate: 100000, effectiveFrom: nowKey } });
    check("fee-rates POST cho lớp monthly_sheet → 409, 0 CourseFeeRate", fr.status === 409 && (await prisma.courseFeeRate.count({ where: { courseId: c1.id } })) === 0, fr.json);
    const fr2 = await A("POST", `/api/courses/${M.C.id}/fee-rates`, { as: M.T, body: { action: "set_student", studentId: M.S["Mai Anh"].id, rate: 50000, effectiveFrom: nowKey } });
    check("fee-rates set_student cũng 409 (không CourseStudentRate)", fr2.status === 409 && (await prisma.courseStudentRate.count()) === 0);

    // duplicate
    const src = await mkWorld("DUP", { startDay: 15 });
    await putCfg(src.C.id, src.T, { subjects: ["Toán", "Lý"], tiers: [{ subjects: 1, rate: 91000 }, { subjects: 2, rate: 81000 }] });
    await importText(src.C.id, src.T, tsv([{ "Họ tên": "Mai Anh", Toán: 4 }]), { ym: periodOf(15) });
    const rowsBefore = await prisma.courseFeeSheetRow.count(), chBefore = await prisma.feeCharge.count();
    const dup = await A("POST", `/api/courses/${src.C.id}/duplicate`, { as: src.T });
    const dupId = dup.json?.id as string;
    const dupT = await prisma.courseFeeTable.findUnique({ where: { courseId: dupId } });
    check("duplicate lớp bảng: bản sao feeMode monthly_sheet + CourseFeeTable giống (môn, bậc, ngày bắt đầu kỳ 15)", dup.status === 200 && (await prisma.course.findUniqueOrThrow({ where: { id: dupId } })).feeMode === "monthly_sheet" && dupT?.subjects.join() === "Toán,Lý" && dupT.periodStartDay === 15 && stableStringify(dupT.tiers) === stableStringify([{ subjects: 1, rate: 91000 }, { subjects: 2, rate: 81000 }]), dup.json);
    check("duplicate KHÔNG sao dòng học phí / FeeCharge / CourseFeeRate; dòng của lớp gốc còn nguyên", (await prisma.courseFeeSheetRow.count({ where: { courseId: dupId } })) === 0 && (await prisma.feeCharge.count({ where: { courseId: dupId } })) === 0 && (await prisma.courseFeeRate.count({ where: { courseId: dupId } })) === 0 && (await prisma.courseFeeSheetRow.count()) === rowsBefore && (await prisma.feeCharge.count()) === chBefore);
    const dupOld = await mkCourse(src.T.id, { name: "Lớp cũ nhân bản" });
    const dup2 = await A("POST", `/api/courses/${dupOld.id}/duplicate`, { as: src.T });
    check("[số cũ] duplicate lớp cách cũ → vẫn lớp cách cũ, không CourseFeeTable", dup2.status === 200 && (await prisma.course.findUniqueOrThrow({ where: { id: dup2.json.id } })).feeMode === "monthly_sessions" && (await prisma.courseFeeTable.count({ where: { courseId: dup2.json.id } })) === 0);
  }

  // ════════════════════════════════ 5. Kỳ thu ════════════════════════════════
  section("5. Ngày bắt đầu kỳ thu 1..28 (0a #8): kỳ hiện tại / nhãn / dateKey FeeCharge; HAS_ROWS");
  {
    const P1 = await mkWorld("KY1"), P15 = await mkWorld("KY15", { startDay: 15 });
    const g1 = await getView(P1.C.id, P1.T), g15 = await getView(P15.C.id, P15.T);
    check(`start 1: kỳ hiện tại = tháng dương lịch ${YM}, nhãn 'tháng MM/YYYY', từ ngày 1 tới cuối tháng`, g1.json.yearMonth === YM && g1.json.currentYearMonth === YM && g1.json.period.label === `tháng ${LABEL(YM)}` && g1.json.period.from === `${YM}-01` && /^\d{4}-\d{2}-(28|29|30|31)$/.test(g1.json.period.to), g1.json.period);
    const cur15 = periodOf(15);
    check(`start 15: kỳ hiện tại (hôm nay ${nowKey}) = ${cur15}, nhãn 'kỳ MM/YYYY (15/.. – 14/..)'`, g15.json.yearMonth === cur15 && g15.json.currentYearMonth === cur15 && g15.json.period.from === `${cur15}-15` && g15.json.period.to === `${shiftYm(cur15, 1)}-14` && g15.json.period.label === `kỳ ${LABEL(cur15)} (15/${cur15.slice(5)} – 14/${shiftYm(cur15, 1).slice(5)})`, g15.json.period);
    const g1115 = await getView(P15.C.id, P15.T, "2026-11");
    check("start 15, ym 2026-11 → 'kỳ 11/2026 (15/11 – 14/12)' từ 2026-11-15 tới 2026-12-14 (ví dụ của đặc tả)", g1115.json.period.label === "kỳ 11/2026 (15/11 – 14/12)" && g1115.json.period.from === "2026-11-15" && g1115.json.period.to === "2026-12-14", g1115.json.period);
    const g1211 = await getView(P15.C.id, P15.T, "2026-12");
    check("start 15, ym 2026-12 → qua năm: tới 2027-01-14", g1211.json.period.to === "2027-01-14" && g1211.json.period.label === "kỳ 12/2026 (15/12 – 14/01)");
    const gP = await getView(P1.C.id, P1.T, "2026-02");
    check("start 1, ym 2026-02 → tới 2026-02-28 (không phụ thuộc múi giờ)", (shiftYm(YM, -12) <= "2026-02" && shiftYm(YM, 12) >= "2026-02") ? gP.json.period.to === "2026-02-28" : true, gP.json.period);

    const w = await putRow(P15.C.id, P15.S["Mai Anh"].id, P15.T, { sessions: { Toán: 8, Anh: 4 }, freeSessions: 1, scholarship: 50000 });
    const ch = (await chargesOf({ courseId: P15.C.id }))[0];
    check(`start 15: ghi dòng không gửi yearMonth → vào kỳ ${cur15}; FeeCharge.yearMonth = ${cur15}, dateKey = '${cur15}-15', nhãn 'Học phí kỳ MM/YYYY · …'`, w.status === 200 && w.json.yearMonth === cur15 && ch.yearMonth === cur15 && ch.dateKey === `${cur15}-15` && ch.label === `Học phí kỳ ${LABEL(cur15)} · 2 môn · 11 buổi · đã trừ học bổng/giảm trừ`, ch);
    const issued = await issue(P15.T, cur15, [P15.S["Mai Anh"].id]);
    check("lập phiếu cho kỳ start 15 qua đường có sẵn: phiếu yearMonth = kỳ, 610.000, FeeCharge.invoiceId đặt", issued.status === 201 && issued.json.created[0].amountDue === 610000 && (await prisma.feeCharge.findUniqueOrThrow({ where: { id: ch.id } })).invoiceId === issued.json.created[0].id);
    const hasRows = await putCfg(P15.C.id, P15.T, { subjects: SUBJ, tiers: TIERS, periodStartDay: 1 });
    check("đổi periodStartDay khi lớp ĐÃ có dòng → 409 HAS_ROWS, giữ nguyên 15", hasRows.status === 409 && hasRows.json.code === "HAS_ROWS" && (await prisma.courseFeeTable.findUniqueOrThrow({ where: { courseId: P15.C.id } })).periodStartDay === 15, hasRows.json);
    const same = await putCfg(P15.C.id, P15.T, { subjects: SUBJ, tiers: TIERS, periodStartDay: 15 });
    check("gửi lại đúng ngày hiện có khi đã có dòng → 200 (không đổi thì không chặn); bỏ trống periodStartDay → giữ nguyên", same.status === 200 && (await putCfg(P15.C.id, P15.T, { subjects: SUBJ, tiers: TIERS })).json.config.periodStartDay === 15);

    for (const d of [1, 14, 28]) {
      const r = await putCfg(P1.C.id, P1.T, { subjects: SUBJ, tiers: TIERS, periodStartDay: d });
      check(`lớp chưa có dòng: periodStartDay ${d} → 200 và lưu`, r.status === 200 && (await prisma.courseFeeTable.findUniqueOrThrow({ where: { courseId: P1.C.id } })).periodStartDay === d);
    }
    const g28 = await getView(P1.C.id, P1.T);
    check(`start 28 → kỳ hiện tại ${periodOf(28)}`, g28.json.yearMonth === periodOf(28));
    for (const d of [0, 29, 1.5, "a", -1, null === 0 ? 0 : "15"]) {
      const r = await putCfg(P1.C.id, P1.T, { subjects: SUBJ, tiers: TIERS, periodStartDay: d });
      check(`periodStartDay ${JSON.stringify(d)} → 400, giữ nguyên 28`, r.status === 400 && (await prisma.courseFeeTable.findUniqueOrThrow({ where: { courseId: P1.C.id } })).periodStartDay === 28);
    }
    const gw = await getView(P15.C.id, P15.T, shiftYm(cur15, 13));
    check("kỳ chọn được chỉ trong ±12 kỳ quanh kỳ hiện tại CỦA LỚP", gw.status === 400 && (await getView(P15.C.id, P15.T, shiftYm(cur15, -12))).status === 200);
  }

  // ════════════════════════════════ 6. Tệp xấu ════════════════════════════════
  section("6. Tệp xấu bị chặn (.xls, .xlsm, cụt, mật khẩu, bom nén, > 1 MB, 301 dòng, thiếu cột, cột lạ, ô công thức / 70k / -5 / 1,5, tên khổng lồ / NUL / chữ vô hình, JSON sai kiểu)");
  const F1 = await mkWorld("FILE1"), F2 = await mkWorld("FILE2");
  const XP = (w: { C: { id: string } }) => `${B(w.C.id)}/nhap/xem-truoc`, XC = (w: { C: { id: string } }) => `${B(w.C.id)}/nhap/xac-nhan`;
  {
    const good = await xlsxBuf([HEAD, ["", "Mai Anh", "", 8, "", "", 4, 1, "", 50000, "", ""], ["", "Bảo Châu", "", 8, 8, 8, 8, "", "", "", 100000, ""]]);
    const before = await counts();
    const mp = (w: typeof F1, name: string, data: Uint8Array) => multipart(XP(w), w.T, { ym: YM }, { name, data });
    const r1 = await mp(F1, "ds.xls", Buffer.from("x")), r2 = await mp(F1, "ds.xlsm", good), r3 = await mp(F1, "ds.exe", Buffer.from("MZ")), r4 = await mp(F1, "ds.pdf", Buffer.from("%PDF"));
    check(".xls / .xlsm / .exe / .pdf → 400 nói rõ", [r1, r2, r3, r4].every(r => r.status === 400 && typeof r.json?.error === "string"), [r1, r2, r3, r4].map(r => r.status));
    const cut = await mp(F1, "cut.xlsx", good.subarray(0, Math.floor(good.length / 2)));
    check("xlsx cắt cụt → 400 'không đọc được'", cut.status === 400 && /không đọc được/.test(cut.json?.error ?? ""), cut.json);
    const notZip = await mp(F1, "x.xlsx", Buffer.from("không phải zip"));
    check("tệp .xlsx không phải zip → 400", notZip.status === 400);
    const ole = Buffer.concat([Buffer.from("D0CF11E0A1B11AE1", "hex"), Buffer.alloc(4096, 0)]);
    const pw = await mp(F1, "co-mat-khau.xlsx", ole);
    check("xlsx CÓ MẬT KHẨU (Office mã hoá = tệp OLE D0CF11E0…, dựng bằng tiêu đề thật, không có exceljs ghi mã hoá) → 400 'có mật khẩu'", pw.status === 400 && /mật khẩu/.test(pw.json?.error ?? ""), pw.json);
    const JSZip = (await import("jszip")).default; const z = new JSZip();
    z.file("xl/worksheets/sheet1.xml", Buffer.alloc(25_000_000, 32));
    const bomb = await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const rb = await mp(F1, "bomb.xlsx", bomb);
    check(`bom nén (${(bomb.length / 1000).toFixed(0)} KB nén → 25 MB giải nén) → 400 'quá lớn', không nạp vào bộ nhớ`, bomb.length < 1_000_000 && rb.status === 400 && /quá lớn/.test(rb.json?.error ?? ""), { size: bomb.length, r: rb.json });
    const z2 = new JSZip(); for (let i = 0; i < 400; i++) z2.file(`xl/f${i}.xml`, "x");
    const many = await mp(F1, "many.xlsx", await z2.generateAsync({ type: "nodebuffer" }));
    check("xlsx 400 mục trong zip (quá XLSX_ENTRIES_MAX) → 400", many.status === 400);
    const big = await mp(F1, "to.csv", Buffer.alloc(1_100_000, 65)), bigx = await mp(F1, "to.xlsx", Buffer.alloc(1_100_000, 80));
    check("tệp > 1 MB (.csv và .xlsx) → 413", big.status === 413 && bigx.status === 413, [big.status, bigx.status]);
    const empty = await mp(F1, "rong.csv", Buffer.alloc(0));
    check("tệp rỗng → 200 fatal 'Tệp trống' (không 500), không ghi gì", empty.status === 200 && !!empty.json.fatal && empty.json.writable === 0, empty.json);
    const noFile = await multipart(XP(F1), F1.T, { ym: YM });
    check("multipart không có tệp và không có text → 400", noFile.status === 400);
    check("không ghi gì sau 13 tệp xấu (xem trước không bao giờ ghi)", (await counts()) === before);

    // .csv với BOM / .tsv / .txt đúng → đọc được
    const csvBom = await mp(F1, "ds.csv", Buffer.from("﻿" + HEAD.join(",") + "\n,Mai Anh,,8,,,4,1,,50000,,\n"));
    check("CSV có BOM đọc được: Mai Anh khớp, Phải đóng 610.000", csvBom.status === 200 && pvRow(csvBom, "Mai Anh")?.net === 610000, csvBom.json?.counts);
    const tsvf = await mp(F1, "ds.tsv", Buffer.from(FIVE_TEXT)), txtf = await mp(F1, "ds.txt", Buffer.from(FIVE_TEXT));
    check(".tsv và .txt đọc được: 5 dòng, tổng 3.130.000", tsvf.json.totalNet === TOTAL && txtf.json.totalNet === TOTAL);

    // 301 dòng
    const rows301 = Array.from({ length: 301 }, (_, i) => ({ "Họ tên": i === 0 ? "Mai Anh" : `Em Số ${i}`, Toán: 1 } as Cells));
    const p301 = await prev(F2.C.id, F2.T, tsv(rows301));
    check("301 dòng → từ chối CẢ TỆP (fatal 'Tối đa 300 dòng… Chia thành nhiều lần'), writable 0, không cắt lặng lẽ", p301.status === 200 && /300/.test(p301.json.fatal ?? "") && /Chia/.test(p301.json.fatal) && p301.json.writable === 0 && p301.json.rows.length === 0, p301.json.fatal);
    const b0 = await counts();
    const c301 = await conf(F2.C.id, F2.T, tsv(rows301), p301.json.fileHash, { skipErrors: true });
    check("xác nhận tệp 301 dòng → 400 FILE_REJECTED, KHÔNG ghi dòng nào (kể cả dòng đầu hợp lệ)", c301.status === 400 && c301.json.code === "FILE_REJECTED" && (await counts()) === b0, c301.json);
    const p300 = await prev(F2.C.id, F2.T, tsv(rows301.slice(0, 300)));
    check("đúng 300 dòng → nhận (fatal null)", p300.status === 200 && p300.json.fatal === null && p300.json.rows.length === 300);
    const x301 = await xlsxBuf([HEAD, ...rows301.map(r => HEAD.map(h => r[h] ?? ""))]);
    const px301 = await multipart(XP(F2), F2.T, { ym: YM }, { name: "301.xlsx", data: x301 });
    check("xlsx 301 dòng → từ chối cả tệp", px301.status === 200 && /300/.test(px301.json.fatal ?? ""), px301.json?.fatal ?? px301.json);

    // thiếu cột / cột lạ
    const noCol = await prev(F2.C.id, F2.T, "Toán\tSử\n8\t8");
    check("thiếu cả cột Họ tên lẫn Mã em → fatal nêu rõ", /Họ tên/.test(noCol.json.fatal ?? "") && noCol.json.writable === 0, noCol.json.fatal);
    const unk = await prev(F2.C.id, F2.T, "Họ tên\tToán\tHoá\nMai Anh\t8\t3");
    check("cột môn LẠ CÓ dữ liệu (Hoá chưa có trong bảng bậc) → fatal nêu tên cột, columns.blocking = [Hoá], writable 0", /Hoá/.test(unk.json.fatal ?? "") && unk.json.columns.blocking.join() === "Hoá" && unk.json.writable === 0, unk.json);
    const unkEmpty = await prev(F2.C.id, F2.T, "Họ tên\tToán\tHoá\nMai Anh\t8\t");
    check("cột lạ TRỐNG hoàn toàn → chỉ liệt vào ignored, vẫn ghi được", unkEmpty.json.fatal === null && unkEmpty.json.columns.ignored.includes("Hoá") && unkEmpty.json.writable === 1);
    const hdr = await prev(F2.C.id, F2.T, "  HỌ   TÊN \t toan \tSỬ\nMai Anh\t8\t2");
    check("tiêu đề có dấu / không dấu / HOA / thừa khoảng trắng đều nhận (Họ tên, toan, SỬ)", hdr.json.fatal === null && pvRow(hdr, "Mai Anh")?.net === 10 * 60000, hdr.json.columns);

    // ô xấu
    const cells = tsv([
      { "Họ tên": "Mai Anh", Toán: 8 },
      {},
      { "Họ tên": "Bảo Châu", Toán: '=HYPERLINK("http://x","a")' },
      { "Họ tên": "Minh Khôi", Toán: "=1+1" },
      { "Họ tên": "Gia Hân", Toán: 2, "Học bổng": "70k" },
      { "Họ tên": "Tuấn Kiệt", Toán: 2, "Học bổng": "-5" },
    ]);
    const pc = await prev(F2.C.id, F2.T, cells);
    check("ô =HYPERLINK / =1+1 trong cột buổi → dòng 'error' (KHÔNG chạy gì, KHÔNG thành số 2); thông điệp nêu SỐ DÒNG THẬT trong tệp (dòng 4, 5 vì có một dòng trống) và tên cột",
      pvRow(pc, "Bảo Châu").status === "error" && pvRow(pc, "Minh Khôi").status === "error" && /Dòng 4, cột “Toán”/.test(pvRow(pc, "Bảo Châu").messages[0]) && /Dòng 5, cột “Toán”/.test(pvRow(pc, "Minh Khôi").messages[0]) && /công thức/.test(pvRow(pc, "Bảo Châu").messages[0]), pc.json.rows.map((r: any) => [r.name, r.status, r.messages]));
    check("ô '70k' và '-5' ở cột tiền → 'error' kèm số dòng thật (6, 7)", pvRow(pc, "Gia Hân").status === "error" && /Dòng 6/.test(pvRow(pc, "Gia Hân").messages[0]) && pvRow(pc, "Tuấn Kiệt").status === "error" && /Dòng 7/.test(pvRow(pc, "Tuấn Kiệt").messages[0]));
    for (const v of ["1,5", "70.5", "1tr", "abc", "1.2.3", "+5"]) {
      const x = await prev(F2.C.id, F2.T, tsv([{ "Họ tên": "Mai Anh", Toán: 2, "Học bổng": v }]));
      check(`ô tiền '${v}' → 'error' (không đoán số)`, pvRow(x, "Mai Anh").status === "error", pvRow(x, "Mai Anh"));
    }
    for (const v of ["70000", "70.000", "70,000", "70 000"]) {
      const x = await prev(F2.C.id, F2.T, tsv([{ "Họ tên": "Mai Anh", Toán: 2, "Học bổng": v }]));
      check(`ô tiền '${v}' → hợp lệ 70.000đ (2 buổi × 70.000 = 140.000 − 70.000 = 70.000)`, pvRow(x, "Mai Anh").status !== "error" && pvRow(x, "Mai Anh").net === 140000 - 70000, pvRow(x, "Mai Anh"));
    }
    check("ô buổi '2.5' / '-1' / '61' / 'tám' → 'error'", (await Promise.all(["2.5", "-1", "61", "tám"].map(v => prev(F2.C.id, F2.T, tsv([{ "Họ tên": "Mai Anh", Toán: v }]))))).every(x => pvRow(x, "Mai Anh").status === "error"));
    const b1 = await counts();
    const cc = await conf(F2.C.id, F2.T, cells, pc.json.fileHash);
    check("xác nhận khi còn dòng sai, không skipErrors → 409 HAS_ERRORS, không ghi gì", cc.status === 409 && cc.json.code === "HAS_ERRORS" && cc.json.errors === 4 && (await counts()) === b1, cc.json);
    const cs = await conf(F2.C.id, F2.T, cells, pc.json.fileHash, { skipErrors: true });
    check("xác nhận với skipErrors → chỉ ghi dòng đúng (Mai Anh), 4 dòng sai bị bỏ", cs.status === 200 && cs.json.written === 1 && cs.json.skipped === 4 && (await prisma.courseFeeSheetRow.count({ where: { courseId: F2.C.id } })) === 1, cs.json);

    // ô chữ trong ghi chú không chạy; tên khổng lồ / NUL / vô hình
    const tricky = tsv([
      { "Họ tên": "Mai Anh", Toán: 2, "Ghi chú": '=HYPERLINK("http://x","a")' },
      { "Họ tên": "Mai\u0000​Anh", Toán: 1 },
      { "Họ tên": "A".repeat(1500), Toán: 1 },
      { "Họ tên": "Bảo Châu", Toán: 1, "Ghi chú": "ghi\u0000chú​ ẩn" },
    ]);
    const pt = await prev(F1.C.id, F1.T, tricky);
    check("tên 1.500 ký tự → không 500, không ghi được (unmatched / error)", pt.status === 200 && ["unmatched", "error"].includes(pt.json.rows[2].status) && pt.json.rows[2].name.length <= 200, pt.json.rows[2].status);
    check("tên có NUL + chữ vô hình ('Mai\\0\\u200bAnh') được làm sạch rồi khớp 'Mai Anh'; em xuất hiện hai lần (dòng 2 và 3 trong tệp) → cả hai 'error'", pt.json.rows[0].status === "error" && pt.json.rows[1].status === "error" && /hai lần/.test(pt.json.rows[1].messages.join()), pt.json.rows.map((r: any) => [r.name, r.status]));
    const tricky2 = tsv([{ "Họ tên": "Mai Anh", Toán: 2, "Ghi chú": '=HYPERLINK("http://x","a")' }, { "Họ tên": "Bảo Châu", Toán: 1, "Ghi chú": "ghi\u0000chú​ ẩn" }]);
    const t2 = await importText(F1.C.id, F1.T, tricky2);
    const nm = await rowOf(F1.C.id, F1.S["Mai Anh"].id), nb = await rowOf(F1.C.id, F1.S["Bảo Châu"].id);
    check("ghi chú '=HYPERLINK(...)' lưu NGUYÊN VĂN là chữ (không chạy, không thành giá trị); NUL và chữ vô hình bị bỏ trước khi ghi (không 500 do byte 0)", t2.c.status === 200 && nm?.note === '=HYPERLINK("http://x","a")' && nb?.note === "ghi chú ẩn" && !/\u0000/.test(nb?.note ?? ""), { nm: nm?.note, nb: nb?.note, c: t2.c.json });

    // xlsx thật: công thức → chỉ lấy kết quả; ô công thức chuỗi không chạy
    const xf = await xlsxBuf([HEAD, ["", "Minh Khôi", "", { formula: "1+1", result: 3 }, "", "", "", "", "", "", "", ""], ["", "Gia Hân", "", '=HYPERLINK("http://x","a")', "", "", "", "", "", "", "", ""]]);
    const pxf = await multipart(XP(F1), F1.T, { ym: YM }, { name: "cong-thuc.xlsx", data: xf });
    check("xlsx: ô công thức {formula:'1+1', result:3} → lấy KẾT QUẢ 3 buổi (210.000), không chạy lại; ô chuỗi '=HYPERLINK' → 'error', không chạy", pvRow(pxf, "Minh Khôi")?.net === 3 * 70000 && pvRow(pxf, "Gia Hân")?.status === "error", pxf.json?.rows?.map((r: any) => [r.name, r.status, r.net]));
    // JSON sai kiểu
    const jb: [string, unknown][] = [
      ["mảng", []], ["chuỗi", "x"], ["null", null], ["ym là số", { ym: 5, text: FIVE_TEXT }], ["ym sai định dạng", { ym: "2026-13", text: FIVE_TEXT }], ["text là số", { ym: YM, text: 123 }], ["không có text", { ym: YM }],
      ["pick là mảng", { ym: YM, text: FIVE_TEXT, pick: [1] }], ["pick giá trị số", { ym: YM, text: FIVE_TEXT, pick: { "2": 5 } }], ["skipLines là đối tượng", { ym: YM, text: FIVE_TEXT, skipLines: { a: 1 } }],
      ["skipLines chứa chữ", { ym: YM, text: FIVE_TEXT, skipLines: ["a"] }], ["fileHash là số", { ym: YM, text: FIVE_TEXT, fileHash: 5 }], ["text quá dài", { ym: YM, text: "x".repeat(400_001) }],
    ];
    const bj = await counts();
    const jo = await Promise.all(jb.flatMap(([n, b]) => [{ n: `xem-truoc ${n}`, p: XP(F1) }, { n: `xac-nhan ${n}`, p: XC(F1) }].map(async x => ({ n: x.n, r: await A("POST", x.p, { as: F1.T, body: b }) }))));
    check("26 thân JSON sai kiểu / thiếu / quá dài trên xem-truoc và xac-nhan → 400 hoặc 413, KHÔNG BAO GIỜ 500; không ghi gì", jo.every(o => o.r.status === 400 || o.r.status === 413) && (await counts()) === bj, jo.filter(o => ![400, 413].includes(o.r.status)).map(o => [o.n, o.r.status]));
    check("thân không phải JSON (chữ hỏng) → 400", (await A("POST", XP(F1), { as: F1.T, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);
  }

  // ════════════════════════════════ 7. Xlsx mẫu thật: tải → điền → thả lại ════════════════════════════════
  section("7. Tải mẫu THẬT → điền → xem trước + xác nhận bằng chính tệp xlsx đó (source 'xlsx')");
  {
    const X = await mkWorld("XLSX");
    const res = await fetch(BASE + `${B(X.C.id)}/mau?ym=${YM}`, { headers: { cookie: await cookieFor(X.T) } });
    const buf = new Uint8Array(await res.arrayBuffer());
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0], guide = wb.worksheets[1];
    const col: Record<string, number> = {}; ws.getRow(1).eachCell((c, i) => { col[String(c.value ?? "").trim()] = i; });
    const allVals: unknown[] = []; wb.worksheets.forEach(s => s.eachRow(r => r.eachCell(c => allVals.push(c.value))));
    check("mẫu: 2 trang tính; tiêu đề đúng (Mã em, Họ tên, Số môn, 4 môn, Miễn, Đơn giá, Học bổng, Giảm trừ, Ghi chú); hàng ví dụ + 5 em đã điền Mã em và Họ tên; MỌI ô là chuỗi / số, không công thức",
      wb.worksheets.length === 2 && guide.name === "Cách điền" && ["Họ tên", "Số môn", "Toán", "Sử", "Địa", "Anh", "Buổi miễn phí", "Đơn giá riêng", "Học bổng", "Giảm trừ", "Ghi chú"].every(h => col[h]) && /^Mã em/.test(String(ws.getRow(1).getCell(1).value)) && ws.rowCount === 7
      && allVals.every(v => !(v && typeof v === "object" && "formula" in (v as object))) && NAMES.every(n => { let f = false; ws.eachRow(r => { if (r.getCell(col["Họ tên"]).value === n && r.getCell(1).value === X.S[n].id) f = true; }); return f; }));
    ws.spliceRows(2, 1); // bỏ hàng ví dụ
    const fill: Record<string, Record<string, number>> = { "Mai Anh": { Toán: 8, Anh: 4, "Buổi miễn phí": 1, "Học bổng": 50000 }, "Bảo Châu": { Toán: 8, Sử: 8, Địa: 8, Anh: 8, "Giảm trừ": 100000 }, "Minh Khôi": { Toán: 8, "Đơn giá riêng": 45000 }, "Gia Hân": { Toán: 6, Sử: 6, "Số môn": 3 }, "Tuấn Kiệt": { Anh: 4, "Học bổng": 300000 } };
    ws.eachRow((row, n) => { if (n === 1) return; const f = fill[String(row.getCell(col["Họ tên"]).value)]; if (f) for (const [k, v] of Object.entries(f)) row.getCell(col[k]).value = v; });
    const filled = new Uint8Array(await wb.xlsx.writeBuffer());
    const p = await multipart(XP(X), X.T, { ym: YM }, { name: "dien.xlsx", data: filled });
    check("thả lại tệp đã điền → xem trước khớp theo MÃ EM (matchedBy 'code'), tổng 3.130.000, 5 dòng ghi được", p.status === 200 && p.json.rows.every((r: any) => r.matchedBy === "code") && p.json.totalNet === TOTAL && p.json.writable === 5, p.json.counts);
    const left = await prev(X.C.id, X.T, FIVE_TEXT);
    check("tệp xlsx và chữ dán cùng nội dung cho CÙNG số (không phụ thuộc đường vào)", left.json.totalNet === p.json.totalNet);
    const c = await multipart(XC(X), X.T, { ym: YM, fileHash: p.json.fileHash }, { name: "dien.xlsx", data: filled });
    const rr = await prisma.courseFeeSheetRow.findMany({ where: { courseId: X.C.id } });
    check("xác nhận xlsx → written 5, source 'xlsx', 4 FeeCharge", c.status === 200 && c.json.written === 5 && rr.length === 5 && rr.every(r => r.source === "xlsx") && (await prisma.feeCharge.count({ where: { courseId: X.C.id } })) === 4, c.json);
    const exRow = await xlsxBuf([HEAD, [`(Ví dụ - xoá dòng này) Mai Anh`, "", "", 8, "", "", "", "", "", "", "", ""], ["", "Bảo Châu", "", 4, "", "", "", "", "", "", "", ""]]);
    const pe = await multipart(XP(X), X.T, { ym: YM }, { name: "vi-du.xlsx", data: exRow });
    check("quên xoá hàng ví dụ của mẫu → KiN bỏ qua và báo (exampleLines), không coi là học sinh", pe.json.exampleLines.join() === "2" && pe.json.rows.length === 1);
  }

  // ════════════════════════════════ 8. Học sinh: trùng tên, pick, lớp khác ════════════════════════════════
  section("8. Học sinh: trùng tên (mã → khớp; không mã → ambiguous), pick lớp khác / đã rời → 400, em lớp khác → unmatched, PUT/DELETE dong em lớp khác → 404");
  {
    const SW = await mkWorld("HS", { names: ["Mai Anh", "Bảo Châu"] });
    const hn1 = await mkUser({ name: "Hà Nhi" }), hn2 = await mkUser({ name: "Hà Nhi" });
    const left = await mkUser({ name: "Em Đã Rời" });
    for (const u of [hn1, hn2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: SW.C.id, status: "active" } });
    await prisma.enrollment.create({ data: { userId: left.id, courseId: SW.C.id, status: "suspended" } });
    const X2 = await mkWorld("HS-LOPKHAC", { names: ["Người Lớp Khác"] });
    const other = X2.S["Người Lớp Khác"];
    await prisma.enrollment.create({ data: { userId: SW.S["Mai Anh"].id, courseId: X2.C.id, status: "active" } }); // Mai Anh học cả hai lớp (khác gia sư)
    const text = tsv([
      { "Mã em": hn1.id, "Họ tên": "Hà Nhi", Toán: 4 },       // dòng 2: khớp theo mã
      { "Họ tên": "Hà Nhi", Anh: 2 },                         // dòng 3: ambiguous
      { "Họ tên": "Người Lớp Khác", Toán: 1 },                // dòng 4: unmatched (em lớp khác, theo tên)
      { "Mã em": other.id, "Họ tên": "Người Lớp Khác", Toán: 1 }, // dòng 5: unmatched (mã em lớp khác)
      { "Mã em": left.id, "Họ tên": "Em Đã Rời", Toán: 1 },   // dòng 6: unmatched (đã rời)
      { "Họ tên": "mai  ANH", Toán: 8 },                      // dòng 7: khác hoa/thường/khoảng trắng → khớp
      { "Họ tên": "Bao Chau", Sử: 2 },                        // dòng 8: không dấu → khớp
      { "Mã em": "ma-la-hoan-toan", "Họ tên": "Bảo Châu", Toán: 1 }, // dòng 9: mã lạ → unmatched (KHÔNG quay sang tên)
    ]);
    const p = await prev(SW.C.id, SW.T, text);
    const R = (line: number) => (p.json.rows as any[]).find(r => r.line === line);
    check("trùng tên + CÓ mã → khớp theo mã (matchedBy 'code'); không mã → 'ambiguous' kèm 2 ứng viên (tên, 4 ký tự cuối mã)", R(2).status === "ok" && R(2).matchedBy === "code" && R(2).studentId === hn1.id && R(3).status === "ambiguous" && R(3).candidates.length === 2 && R(3).candidates.every((c: any) => c.tail.length === 4 && c.name === "Hà Nhi") && R(3).studentId === null, p.json.rows.map((r: any) => [r.line, r.status]));
    check("em lớp khác / mã lớp khác / em đã rời (suspended) / mã lạ → 'unmatched' (không tạo em, không quay sang khớp tên)", [4, 5, 6, 9].every(l => R(l).status === "unmatched" && R(l).studentId === null), [4, 5, 6, 9].map(l => R(l).status));
    check("khác hoa thường / khoảng trắng / dấu ('mai  ANH', 'Bao Chau') vẫn khớp", R(7).status === "ok" && R(7).studentId === SW.S["Mai Anh"].id && R(8).status === "ok" && R(8).studentId === SW.S["Bảo Châu"].id);
    check("rosterNotInFile: em của lớp không có trong tệp (hn2) được liệt kê; em đã rời không có trong roster", p.json.rosterNotInFile.some((x: any) => x.studentId === hn2.id) && !p.json.rosterNotInFile.some((x: any) => x.studentId === left.id));
    const b0 = await counts();
    const c0 = await conf(SW.C.id, SW.T, text, p.json.fileHash);
    check("xác nhận khi còn ambiguous / unmatched, không skipErrors / pick → 409 HAS_ERRORS (đếm unmatched 4, ambiguous 1), không ghi gì", c0.status === 409 && c0.json.code === "HAS_ERRORS" && c0.json.unmatched === 4 && c0.json.ambiguous === 1 && (await counts()) === b0, c0.json);
    const badPicks: [string, Record<string, string>][] = [
      ["em LỚP KHÁC", { "3": other.id }], ["em ĐÃ RỜI", { "3": left.id }], ["id không có thật", { "3": "khong-ton-tai" }], ["dòng đã khớp (không cần chọn)", { "2": hn2.id }],
      ["dòng không có trong tệp", { "99": hn2.id }], ["một em cho hai dòng", { "3": hn2.id, "4": hn2.id }], ["id rỗng", { "3": "" }],
    ];
    for (const [n, pick] of badPicks) {
      const px = await prev(SW.C.id, SW.T, text, { pick });
      const cx = await conf(SW.C.id, SW.T, text, p.json.fileHash, { pick, skipErrors: true });
      check(`pick sang ${n} → 400 BAD_PICK (xem trước lẫn xác nhận), không ghi`, px.status === 400 && cx.status === 400 && cx.json.code === "BAD_PICK" && (await counts()) === b0, [px.status, cx.status, cx.json]);
    }
    const pk = await prev(SW.C.id, SW.T, text, { pick: { "3": hn2.id } });
    check("pick đúng (em hn2 cho dòng ambiguous) → dòng 3 thành 'ok' với studentId hn2", R(3).status === "ambiguous" && pvRow(pk, "Hà Nhi") !== undefined && (pk.json.rows as any[]).find(r => r.line === 3).status === "ok" && (pk.json.rows as any[]).find(r => r.line === 3).studentId === hn2.id);
    const ck = await conf(SW.C.id, SW.T, text, pk.json.fileHash, { pick: { "3": hn2.id }, skipErrors: true });
    const rws = await prisma.courseFeeSheetRow.findMany({ where: { courseId: SW.C.id } });
    check("xác nhận với pick + skipErrors → ghi 4 dòng (hn1, hn2, Mai Anh, Bảo Châu); em lớp khác / đã rời KHÔNG có dòng; skipped 4", ck.status === 200 && ck.json.written === 4 && rws.length === 4 && rws.every(r => [hn1.id, hn2.id, SW.S["Mai Anh"].id, SW.S["Bảo Châu"].id].includes(r.studentId)) && !rws.some(r => r.studentId === other.id || r.studentId === left.id), ck.json);
    const hn1Row = (await rowOf(SW.C.id, hn1.id))!, hn2Row = (await rowOf(SW.C.id, hn2.id))!;
    check("mỗi em trùng tên một dòng riêng với số riêng (hn1 Toán 4 = 280.000; hn2 Anh 2 = 140.000)", hn1Row.net === 280000 && hn2Row.net === 140000);
    const dupSame = await prev(SW.C.id, SW.T, tsv([{ "Họ tên": "Mai Anh", Toán: 1 }, { "Mã em": SW.S["Mai Anh"].id, Toán: 2 }]));
    check("em xuất hiện hai lần (một theo tên, một theo mã) → cả hai dòng 'error'", dupSame.json.rows.every((r: any) => r.status === "error"));
    const skipL = await prev(SW.C.id, SW.T, tsv([{ "Họ tên": "Mai Anh", Toán: 1 }, { "Họ tên": "Bảo Châu", Toán: 1 }]));
    const cskip = await conf(SW.C.id, SW.T, tsv([{ "Họ tên": "Mai Anh", Toán: 1 }, { "Họ tên": "Bảo Châu", Toán: 1 }]), skipL.json.fileHash, { skipLines: [3] });
    check("skipLines [3] bỏ đúng dòng Bảo Châu (chỉ Mai Anh ghi)", cskip.json.written === 1 && (await rowOf(SW.C.id, SW.S["Mai Anh"].id))!.billable === 1 && (await rowOf(SW.C.id, SW.S["Bảo Châu"].id))!.billable !== 1);

    for (const [n, sid] of [["lớp khác", other.id], ["đã rời", left.id], ["không có thật", "khong-ton-tai"]] as const) {
      const b = await counts();
      const pr = await putRow(SW.C.id, sid, SW.T, { sessions: { Toán: 8 } });
      const pd = await putRow(SW.C.id, sid, SW.T, { sessions: { Toán: 8 }, dryRun: true });
      const dl = await delRow(SW.C.id, sid, SW.T);
      check(`PUT /dong/<em ${n}> → 404 STUDENT_NOT_IN_COURSE (cả dryRun), DELETE → 404, không ghi / không lộ`, pr.status === 404 && pr.json.code === "STUDENT_NOT_IN_COURSE" && pd.status === 404 && dl.status === 404 && (await counts()) === b && !/Người Lớp Khác|Em Đã Rời/.test(pr.text + dl.text), [pr.status, pd.status, dl.status]);
    }
    await prisma.enrollment.update({ where: { userId_courseId: { userId: hn1.id, courseId: SW.C.id } }, data: { status: "suspended" } });
    const gl = await getView(SW.C.id, SW.T);
    const gl1 = (gl.json.rows as any[]).find(r => r.studentId === hn1.id);
    check("em đã rời lớp mà vẫn có dòng cũ → GET vẫn hiện (left:true, name, số) — không mất lịch sử; em chưa có dòng và đã rời thì không hiện", gl1?.left === true && gl1.net === 280000 && !(gl.json.rows as any[]).some(r => r.studentId === left.id));
    const pl = await putRow(SW.C.id, hn1.id, SW.T, { sessions: { Toán: 1 } });
    check("em vừa rời → không sửa được nữa (404)", pl.status === 404);
  }

  // ════════════════════════════════ 9. Khoá ════════════════════════════════
  section("9. Khoá: dòng đã có phiếu → locked (FeeCharge + phiếu giữ nguyên byte); phiếu đã gửi → locked; phiếu nháp → warn + ghi được; song song với lập phiếu");
  {
    const LK = await mkWorld("LOCK", { names: ["Mai Anh", "Bảo Châu", "Minh Khôi", "Gia Hân", "Tuấn Kiệt", "Em Nháp", "Em Đã Gửi"] });
    const LG = await mkCourse(LK.T.id, { name: "Lớp cũ cùng gia sư" });
    await prisma.monthlyCourseFee.create({ data: { courseId: LG.id, yearMonth: YM, sessionCount: 8, updatedBy: LK.T.id } });
    for (const n of ["Em Nháp", "Em Đã Gửi"]) await prisma.enrollment.create({ data: { userId: LK.S[n].id, courseId: LG.id, status: "active" } });
    await importText(LK.C.id, LK.T, tsv(FIVE.slice(0, 4)));
    const mai = LK.S["Mai Anh"].id;
    const iss = await issue(LK.T, YM, [mai]);
    const inv = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: iss.json.created[0].id } });
    const chMai = await prisma.feeCharge.findFirstOrThrow({ where: { studentId: mai, courseId: LK.C.id } });
    check("lập phiếu cho Mai Anh qua đường có sẵn → 610.000, FeeCharge.invoiceId đặt", iss.status === 201 && inv.amountDue === 610000 && chMai.invoiceId === inv.id);
    const snapM = async () => JSON.stringify([await prisma.feeCharge.findUniqueOrThrow({ where: { id: chMai.id } }), await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: inv.id } }), await rowOf(LK.C.id, mai)]);
    const s0 = await snapM();
    const edit = tsv([{ "Họ tên": "Mai Anh", Toán: 20, Anh: 10, "Học bổng": 1000 }, { "Họ tên": "Bảo Châu", Toán: 1 }]);
    const pe = await prev(LK.C.id, LK.T, edit);
    check("xem trước: dòng đã có phiếu → 'locked' (lý do bằng chữ, nêu 'Sửa số tiền phiếu'); dòng khác vẫn ghi được", pvRow(pe, "Mai Anh").status === "locked" && /Sửa số tiền phiếu/.test(pvRow(pe, "Mai Anh").messages[0]) && pvRow(pe, "Bảo Châu").status === "replace" && pe.json.counts.locked === 1, pe.json.counts);
    const ce = await conf(LK.C.id, LK.T, edit, pe.json.fileHash);
    check("xác nhận không thay số dòng locked (locked 1, written 1); FeeCharge + phiếu + dòng của Mai Anh giữ nguyên BYTE", ce.status === 200 && ce.json.locked === 1 && ce.json.written === 1 && (await snapM()) === s0, ce.json);
    const pr = await putRow(LK.C.id, mai, LK.T, { sessions: { Toán: 1 } }), dl = await delRow(LK.C.id, mai, LK.T);
    check("PUT / DELETE dòng đã vào phiếu → 409 ROW_LOCKED, giữ nguyên byte", pr.status === 409 && pr.json.code === "ROW_LOCKED" && dl.status === 409 && dl.json.code === "ROW_LOCKED" && (await snapM()) === s0);
    const gv = await getView(LK.C.id, LK.T);
    const gm = (gv.json.rows as any[]).find(r => r.studentId === mai);
    check("GET: dòng locked:true + phiếu {code, status draft, 'Nháp', amountDue 610.000, remaining 610.000}", gm.locked === true && gm.invoice?.status === "draft" && gm.invoice.amountDue === 610000 && gm.invoice.remaining === 610000 && gm.invoice.code === inv.code && typeof gm.invoice.statusLabel === "string", gm.invoice);

    // phiếu nháp từ lớp khác → warn, ghi được; phiếu đã gửi → locked
    const draft = await issue(LK.T, YM, [LK.S["Em Nháp"].id]), sent = await issue(LK.T, YM, [LK.S["Em Đã Gửi"].id]);
    await A("PATCH", `/api/tutor/invoices/${sent.json.created[0].id}`, { as: LK.T, body: { action: "send" } });
    const invD0 = JSON.stringify(await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: draft.json.created[0].id } })), invS0 = JSON.stringify(await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: sent.json.created[0].id } }));
    const t3 = tsv([{ "Họ tên": "Em Nháp", Toán: 4 }, { "Họ tên": "Em Đã Gửi", Toán: 4 }]);
    const p3 = await prev(LK.C.id, LK.T, t3);
    check("phiếu NHÁP của em từ lớp khác → 'warn' (nêu 'Gộp khoản rời') và ghi được; phiếu ĐÃ GỬI → 'locked' (dù chưa có FeeCharge)", pvRow(p3, "Em Nháp").status === "warn" && /Gộp khoản rời/.test(pvRow(p3, "Em Nháp").messages.join()) && pvRow(p3, "Em Đã Gửi").status === "locked" && /đã gửi/.test(pvRow(p3, "Em Đã Gửi").messages[0]), p3.json.rows.map((r: any) => [r.name, r.status, r.messages]));
    const c3 = await conf(LK.C.id, LK.T, t3, p3.json.fileHash);
    const cD = await prisma.feeCharge.findMany({ where: { studentId: LK.S["Em Nháp"].id, courseId: LK.C.id } });
    check("ghi: Em Nháp có dòng + FeeCharge RỜI (invoiceId null); Em Đã Gửi KHÔNG có dòng; hai phiếu giữ nguyên byte", c3.json.written === 1 && c3.json.locked === 1 && cD.length === 1 && cD[0].invoiceId === null && cD[0].amount === 280000 && (await rowOf(LK.C.id, LK.S["Em Đã Gửi"].id)) === null
      && JSON.stringify(await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: draft.json.created[0].id } })) === invD0 && JSON.stringify(await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: sent.json.created[0].id } })) === invS0, c3.json);
    const pdr = await putRow(LK.C.id, LK.S["Em Đã Gửi"].id, LK.T, { sessions: { Toán: 3 } });
    check("PUT dong cho em có phiếu đã gửi → 409 ROW_LOCKED", pdr.status === 409 && pdr.json.code === "ROW_LOCKED");

    // song song: xác nhận (đổi số) × lập phiếu thật
    const RACE = await mkWorld("RACE", { names: ["Em 1", "Em 2", "Em 3", "Em 4", "Em 5", "Em 6", "Em 7", "Em 8"] });
    const base = (n: string) => ({ "Họ tên": n, Toán: 4 });
    await importText(RACE.C.id, RACE.T, tsv(Object.keys(RACE.S).map(base)));
    const results: string[] = [];
    for (const [i, n] of Object.keys(RACE.S).entries()) {
      const text = tsv([{ "Họ tên": n, Toán: 8 + i }]);
      const pv = await prev(RACE.C.id, RACE.T, text);
      const [rc, ri] = await Promise.all([conf(RACE.C.id, RACE.T, text, pv.json.fileHash), issue(RACE.T, YM, [RACE.S[n].id])]);
      results.push(`${n}:${rc.status}/${ri.status}`);
      const sid = RACE.S[n].id;
      const chs = await prisma.feeCharge.findMany({ where: { studentId: sid, courseId: RACE.C.id } }), invs = await prisma.tuitionInvoice.findMany({ where: { studentId: sid } }), row = await rowOf(RACE.C.id, sid);
      const okShape = chs.length === 1 && invs.length === 1 && row !== null && chs[0].invoiceId === invs[0].id && invs[0].amountDue === chs[0].amount && row.net === chs[0].amount && ((invs[0].breakdown as any)?.chargesTotal === chs[0].amount) && [200, 409].includes(rc.status) && ri.status === 201;
      check(`song song xac-nhan × lập phiếu (${n}): đúng 1 dòng, 1 FeeCharge, 1 phiếu; tổng phiếu = số của dòng phí = số của dòng bảng (xac-nhan ${rc.status})`, okShape, { chs: chs.map(c => [c.amount, c.invoiceId]), invs: invs.map(v => [v.amountDue, v.id]), row: row?.net, rc: rc.json, ri: ri.status });
    }
    void results;
    // nhiều lần xác nhận song song cùng (lớp, kỳ)
    const PAR = await mkWorld("PAR");
    const pp = await prev(PAR.C.id, PAR.T, FIVE_TEXT);
    const outs = await Promise.all([0, 1, 2, 3, 4].map(() => conf(PAR.C.id, PAR.T, FIVE_TEXT, pp.json.fileHash)));
    check("5 xác nhận SONG SONG cùng tệp → không 5xx, vẫn đúng 5 dòng + 4 FeeCharge (không nhân đôi), số đúng", outs.every(o => o.status === 200) && (await prisma.courseFeeSheetRow.count({ where: { courseId: PAR.C.id } })) === 5 && (await prisma.feeCharge.count({ where: { courseId: PAR.C.id } })) === 4 && (await prisma.feeCharge.aggregate({ where: { courseId: PAR.C.id }, _sum: { amount: true } }))._sum.amount === TOTAL, outs.map(o => o.json?.written));
  }

  // ════════════════════════════════ 10. Phiếu thật ════════════════════════════════
  section("10. Phiếu thật: Mai Anh 610.000 (chargeLines có dòng 'Học phí…'); StudentDiscount 10% → 549.000 và xem trước đã cảnh báo");
  {
    const K = await mkWorld("PHIEU");
    await importText(K.C.id, K.T, FIVE_TEXT);
    const mai = K.S["Mai Anh"].id;
    const r = await issue(K.T, YM, [mai]);
    const inv = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: r.json.created[0].id } });
    const bd = inv.breakdown as any;
    const ch = await prisma.feeCharge.findFirstOrThrow({ where: { studentId: mai, courseId: K.C.id } });
    check("issueInvoice Mai Anh → amountDue 610.000", r.status === 201 && inv.amountDue === 610000 && inv.yearMonth === YM && inv.status === "draft", inv);
    check("breakdown.chargeLines có dòng 'Học phí MM/YYYY · 2 môn · 11 buổi · đã trừ học bổng/giảm trừ' = 610.000; chargesTotal 610.000", bd.chargesTotal === 610000 && bd.chargeLines.some((l: any) => l.description === `Học phí ${LABEL(YM)} · 2 môn · 11 buổi · đã trừ học bổng/giảm trừ` && l.amount === 610000 && l.count === 1), bd.chargeLines);
    check("FeeCharge.invoiceId đặt đúng phiếu (đóng băng)", ch.invoiceId === inv.id);
    const rbc = await issue(K.T, YM, [K.S["Bảo Châu"].id]), rtk = await issue(K.T, YM, [K.S["Tuấn Kiệt"].id]);
    check("Bảo Châu → phiếu 1.500.000; Tuấn Kiệt (Phải đóng 0đ, không FeeCharge) → không lập phiếu, có lý do", rbc.json.created[0]?.amountDue === 1500000 && rtk.json.created.length === 0 && /Chưa có buổi nào được tính phí/.test(rtk.json.skipped[0]?.reason ?? ""), [rbc.json, rtk.json]);
    await prisma.studentDiscount.create({ data: { tutorId: K.T.id, studentId: mai, percent: 10, updatedBy: K.T.id } });
    const tPrev = tsv([{ "Họ tên": "Mai Anh", Toán: 8, Anh: 4, "Buổi miễn phí": 1, "Học bổng": 50000 }]);
    const pv = await prev(K.C.id, K.T, tPrev, { ym: YM_PREV });
    check("xem trước CẢNH BÁO 'giảm hai lần' khi em đang được giảm 10% ở Học phí (status warn)", pvRow(pv, "Mai Anh").status === "warn" && /10%/.test(pvRow(pv, "Mai Anh").messages.join()) && /giảm hai lần/.test(pvRow(pv, "Mai Anh").messages.join()), pvRow(pv, "Mai Anh"));
    await conf(K.C.id, K.T, tPrev, pv.json.fileHash, { ym: YM_PREV });
    const r2 = await issue(K.T, YM_PREV, [mai]);
    const inv2 = await prisma.tuitionInvoice.findUniqueOrThrow({ where: { id: r2.json.created[0].id } });
    check("lập phiếu kỳ trước khi có StudentDiscount 10% → 549.000 (610.000 − 61.000), breakdown.percentOff 10, percentAmount 61.000", inv2.amountDue === 549000 && (inv2.breakdown as any).percentOff === 10 && (inv2.breakdown as any).percentAmount === 61000, inv2);
    check("cộng dòng phí của lớp bảng vẫn đúng: tổng FeeCharge của lớp = 610.000 + 1.500.000 + 360.000 + 660.000 + 610.000", (await prisma.feeCharge.aggregate({ where: { courseId: K.C.id }, _sum: { amount: true } }))._sum.amount === TOTAL + 610000);
  }

  // ════════════════════════════════ 11. Thông báo + audit + riêng tư ════════════════════════════════
  section("11. Không Notification sau nhập / sửa / xoá khi chủ ghi; AuditLog có đủ ba loại; metadata không có tên mẫu / số điện thoại");
  {
    const logs = await prisma.auditLog.findMany({ where: { action: { startsWith: "fee_sheet." } } });
    const byType = (a: string) => logs.filter(l => l.action === a).length;
    check("AuditLog có đủ 3 loại fee_sheet.config / fee_sheet.import / fee_sheet.row", byType("fee_sheet.config") > 0 && byType("fee_sheet.import") > 0 && byType("fee_sheet.row") > 0, [byType("fee_sheet.config"), byType("fee_sheet.import"), byType("fee_sheet.row")]);
    const blob = JSON.stringify(logs.map(l => l.metadata));
    check(`quét metadata của ${logs.length} dòng audit: không tên mẫu (Mai Anh, Bảo Châu, Minh Khôi, Gia Hân, Tuấn Kiệt, Hà Nhi), không số điện thoại, không ghi chú`, !/Mai Anh|Bảo Châu|Minh Khôi|Gia Hân|Tuấn Kiệt|Hà Nhi|Em Nháp/.test(blob) && !/(\+84|\b0)\d{9,10}\b/.test(blob) && !/0912345678|HYPERLINK/.test(blob), blob.slice(0, 200));
    check("metadata audit không có studentId / name / net từng em", logs.every(l => { const k = Object.keys(l.metadata as object); return !k.includes("studentId") && !k.includes("name") && !k.includes("net") && !k.includes("note"); }));
    check("import: metadata có số đếm + totalNet (không số từng em)", logs.filter(l => l.action === "fee_sheet.import").every(l => typeof (l.metadata as any).totalNet === "number" && typeof (l.metadata as any).written === "number"));
    const types = await prisma.notification.groupBy({ by: ["type"], _count: true });
    check("toàn bộ test chủ lớp tự ghi: chỉ có thông báo course_fee_override do QUẢN TRỊ gây ra (mục 1b), không loại nào khác", types.every(t => t.type === "course_fee_override"), types);
  }

  // ════════════════════════════════ 12. Bản xem trước (VERCEL_ENV=preview) ════════════════════════════════
  section("12. VERCEL_ENV=preview: máy chủ thử không chạy ở chế độ đó → kiểm hàm moneyPathsBlocked + quét mã (KHÔNG kiểm được qua HTTP)");
  {
    check("moneyPathsBlocked({VERCEL_ENV:'preview'}) = true; production / development / trống = false", moneyPathsBlocked({ VERCEL_ENV: "preview" }) === true && moneyPathsBlocked({ VERCEL_ENV: "production" }) === false && moneyPathsBlocked({ VERCEL_ENV: "development" }) === false && moneyPathsBlocked({}) === false);
    check("máy chủ thử đang chạy KHÔNG ở chế độ preview (nên ca 503 qua HTTP không kiểm được; ghi trong phiếu bàn giao)", process.env.VERCEL_ENV !== "preview");
    const root = join(process.cwd(), "src/app/api/tutor/lop/[courseId]/bang-hoc-phi");
    const src = (p: string) => readFileSync(join(root, p), "utf8");
    const writes = ["cau-hinh/route.ts", "nhap/xac-nhan/route.ts", "dong/[studentId]/route.ts"].map(src), reads = ["route.ts", "mau/route.ts", "nhap/xem-truoc/route.ts"].map(src);
    check("QUÉT MÃ: 3 điểm ghi (cau-hinh, xac-nhan, dong) đều gọi moneyPathsBlocked() → 503; PUT dong chỉ chặn khi KHÔNG dryRun; 3 điểm chỉ đọc không chặn", writes.every(s => s.includes("moneyPathsBlocked()") && s.includes("previewBlocked()")) && /!dryRun && moneyPathsBlocked\(\)/.test(writes[2]) && reads.every(s => !s.includes("moneyPathsBlocked")));
  }

  // ════════════════════════════════ 13. Lời mời lớp (invites/by-code) ════════════════════════════════
  section("13. GET /api/invites/by-code/<mã>: lớp monthly_sheet → tuition: null; lớp cách cũ / theo buổi vẫn có tuition");
  {
    const IV = await mkTutor("Cô Mã Mời");
    const mk = async (name: string, mode: string) => { const c = await mkCourse(IV.id, { name }); await prisma.course.update({ where: { id: c.id }, data: { feeMode: mode, price: 100000 } }); return c; };
    const cSheet = await mk("Lớp mời bảng", "monthly_sheet"), cLegacy = await mk("Lớp mời cũ", "monthly_sessions"), cPer = await mk("Lớp mời theo buổi", "per_session");
    const NEWS = await mkUser({ name: "Em Mới Vào" });
    const code = async (c: { id: string }) => (await A("POST", `/api/courses/${c.id}/invites`, { as: IV, body: { maxUses: 5 } })).json.code as string;
    const pv = async (c: { id: string }) => A("GET", `/api/invites/by-code/${await code(c)}`, { as: NEWS });
    const a = await pv(cSheet), b = await pv(cLegacy), p = await pv(cPer);
    check("lớp monthly_sheet → 200 status ok, tuition: null (không hiện bậc chung 70/60/55/50 sai)", a.status === 200 && a.json.status === "ok" && a.json.tuition === null, a.json.tuition);
    check("[số cũ] lớp cách cũ vẫn có tuition (1 môn → 70.000đ)", b.json.tuition?.subjectCount === 1 && b.json.tuition?.pricePerSession === 70000, b.json.tuition);
    check("[số cũ] lớp theo buổi vẫn có tuition như trước (không đổi hành vi)", p.json.tuition?.pricePerSession === 70000, p.json.tuition);
    check("xem trước lời mời lớp bảng không ghi danh, không tăng lượt dùng", (await prisma.enrollment.count({ where: { userId: NEWS.id } })) === 0);
  }

  // ════════════════════════════════ 14. Giới hạn tốc độ xem trước ════════════════════════════════
  section("14. Xem trước 40 lần / phút / gia sư (429)");
  {
    const RL = await mkWorld("RL");
    const outs: number[] = [];
    for (let i = 0; i < 44; i++) outs.push((await prev(RL.C.id, RL.T, FIVE_TEXT)).status);
    check("44 lần xem trước liên tiếp: 40 lần đầu 200 rồi 429 (không 5xx)", outs.slice(0, 40).every(s => s === 200) && outs.slice(40).every(s => s === 429), outs.join());
    const other = await prev(RL.C.id, ADC, FIVE_TEXT);
    check("giới hạn theo từng người: quản trị vẫn xem trước được", other.status === 200);
  }

  // ════════════════════════════════ 15. BẤT BIẾN ════════════════════════════════
  section("15. BẤT BIẾN — phiếu / dòng phí / bậc / giảm giá của lớp KHÁC không đổi một byte khi chạy TOÀN BỘ tính năng mới");
  await wipe();
  {
    const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
    const mkIn = async (name: string, courseIds: string[]) => { const u = await mkUser({ name }); for (const c of courseIds) await prisma.enrollment.create({ data: { userId: u.id, courseId: c, status: "active" } }); return u; };
    const L1 = await mkCourse(T1.id, { name: "Toán cũ" }), L2 = await mkCourse(T1.id, { name: "Lý cũ" });
    const PS = await mkCourse(T1.id, { name: "Anh theo buổi" }), PC = await mkCourse(T1.id, { name: "Văn theo khoá" }), L3 = await mkCourse(T2.id, { name: "Hoá của thầy Minh" });
    await prisma.course.update({ where: { id: PS.id }, data: { feeMode: "per_session" } }); await prisma.course.update({ where: { id: PC.id }, data: { feeMode: "per_course" } });
    for (const [c, ym, n, f] of [[L1, YM_PREV, 8, 0], [L1, YM, 8, 1], [L2, YM_PREV, 4, 0], [L2, YM, 4, 0], [L3, YM_PREV, 6, 0]] as const) await prisma.monthlyCourseFee.create({ data: { courseId: c.id, yearMonth: ym, sessionCount: n, freeCount: f, updatedBy: T1.id } });
    await prisma.courseFeeRate.create({ data: { courseId: PS.id, mode: "per_session", rate: 150000, effectiveFrom: "2000-01-01", createdBy: T1.id } });
    await prisma.courseFeeRate.create({ data: { courseId: PC.id, mode: "per_course", rate: 3000000, effectiveFrom: "2000-01-01", createdBy: T1.id } });
    const sA = await mkIn("Em A", [L1.id]), sB = await mkIn("Em B", [L1.id, L2.id]), sC = await mkIn("Em C", [L1.id]), sD = await mkIn("Em D", [PS.id]), sE = await mkIn("Em E", [PC.id]), sK = await mkIn("Em K", [L1.id]), sM = await mkIn("Em M", [L3.id]);
    const F = await mkIn("Em Học Hai Lớp F", [L1.id, L2.id]), G = await mkIn("Em Học Hai Lớp G", [L1.id]);
    await prisma.tuitionOverride.create({ data: { userId: sC.id, pricePerSession: 40000, updatedBy: T1.id } });
    await prisma.studentDiscount.create({ data: { tutorId: T1.id, studentId: sC.id, percent: 10, updatedBy: T1.id } });
    await prisma.courseStudentRate.create({ data: { courseId: PS.id, studentId: sD.id, rate: 120000, effectiveFrom: "2000-01-01", createdBy: T1.id } });
    await prisma.sessionPackage.create({ data: { tutorId: T1.id, courseId: PS.id, studentId: sD.id, sessions: 10, unitPrice: 150000, totalPrice: 1500000, createdBy: T1.id } });
    await prisma.tuitionCredit.create({ data: { tutorId: T1.id, studentId: sB.id, amount: 100000, usedAmount: 0 } });
    // phiếu: nháp (A), đã gửi (B, dùng tín dụng), đã đóng (C), huỷ (K), theo buổi có FeeCharge vào phiếu (D) + FeeCharge chưa vào phiếu, theo khoá (E), hai lớp cũ F/G, thầy khác (M)
    const mkCh = (courseId: string, studentId: string, kind: string, ym: string, amount: number, mode: string, extra: object = {}) => prisma.feeCharge.create({ data: { tutorId: T1.id, courseId, studentId, kind, dateKey: `${ym}-05`, yearMonth: ym, amount, rate: amount, mode, ...extra } });
    await mkCh(PS.id, sD.id, "session", YM_PREV, 120000, "per_session"); await mkCh(PS.id, sD.id, "session", YM_PREV, 120000, "per_session");
    await mkCh(PC.id, sE.id, "course", YM_PREV, 3000000, "per_course");
    for (const s of [sA, sB, sC, sD, sE, sK, F, G]) {
      const r = await issueInvoice({ tutorId: T1.id, studentId: s.id, yearMonth: YM_PREV });
      if (!r.ok) throw new Error(`dựng dữ liệu 'trước' thất bại cho ${s.name}: ${r.reason}`);
    }
    await issueInvoice({ tutorId: T2.id, studentId: sM.id, yearMonth: YM_PREV });
    await mkCh(PS.id, sD.id, "session", YM, 120000, "per_session"); // FeeCharge CHƯA vào phiếu (kỳ này)
    const invOf = async (s: TUser) => prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: s.id, yearMonth: YM_PREV } });
    await A("PATCH", `/api/tutor/invoices/${(await invOf(sB)).id}`, { as: T1, body: { action: "send" } });
    await A("PATCH", `/api/tutor/invoices/${(await invOf(sC)).id}`, { as: T1, body: { action: "send" } });
    await A("PATCH", `/api/tutor/invoices/${(await invOf(sC)).id}`, { as: T1, body: { action: "record_payment", amount: (await invOf(sC)).amountDue } });
    await A("PATCH", `/api/tutor/invoices/${(await invOf(sK)).id}`, { as: T1, body: { action: "cancel", reason: "Em nghỉ học" } });
    const fInvPrev = await invOf(F), gInvPrev = await invOf(G);
    const inv0 = await prisma.tuitionInvoice.findMany();
    check("dữ liệu 'trước' dựng đủ: phiếu nháp / đã gửi / đã đóng / huỷ; FeeCharge đã vào phiếu + chưa vào phiếu; MonthlyCourseFee; đơn giá lớp / riêng; giảm %; override; gói buổi", ["draft", "sent", "paid", "cancelled"].every(s => inv0.some(i => i.status === s)) && (await prisma.feeCharge.count({ where: { invoiceId: null } })) === 1 && (await prisma.feeCharge.count({ where: { invoiceId: { not: null } } })) >= 3 && (await prisma.tuitionCredit.findFirstOrThrow()).usedAmount > 0, inv0.map(i => i.status));
    check("phiếu 'trước' của em học hai lớp cũ F: bậc 60.000 (2 môn cũ), gốc (8+4)×60.000 = 720.000; G (1 môn cũ): 70.000", (fInvPrev.breakdown as any).pricePerSession === 60000 && (fInvPrev.breakdown as any).gross === 720000 && (gInvPrev.breakdown as any).pricePerSession === 70000 && (gInvPrev.breakdown as any).gross === 560000, [(fInvPrev.breakdown as any).pricePerSession, (gInvPrev.breakdown as any).gross]);

    const TABLES = ["tuitionInvoice", "feeCharge", "monthlyCourseFee", "courseFeeRate", "courseStudentRate", "studentDiscount", "tuitionOverride", "sessionPackage", "tuitionCredit"] as const;
    type Snap = Record<(typeof TABLES)[number], Map<string, { json: string; row: any }>>;
    const snap = async (): Promise<Snap> => {
      const out = {} as Snap;
      for (const t of TABLES) { const rows = await (prisma as any)[t].findMany({ orderBy: { id: "asc" } }); out[t] = new Map(rows.map((r: any) => [r.id, { json: JSON.stringify(r), row: r }])); }
      return out;
    };
    const hashOf = (m: Map<string, { json: string }>) => createHash("sha256").update([...m.entries()].map(([k, v]) => k + v.json).join("\n")).digest("hex").slice(0, 12);
    const before = await snap();
    const hashes0 = Object.fromEntries(TABLES.map(t => [t, hashOf(before[t])]));
    console.log("    băm 'trước':", Object.entries(hashes0).map(([k, v]) => `${k}=${v}`).join(" "));
    const fixed = { price: [1, 2, 3, 4, 5].map(k => pricePerSessionVnd(k)), tiers: TUITION_TIER_VND };

    // ── chạy TOÀN BỘ tính năng mới ──
    const created = await A("POST", "/api/courses", { as: T1, body: { category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null, bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true, id: `hpl-inv-${Date.now().toString(36)}`, name: "Lớp bảng bất biến", adminName: "Lớp bảng bất biến", shortTitle: "LB", feeMode: "monthly_sheet" } });
    const SC = { id: (created.json?.id ?? (await prisma.course.findFirstOrThrow({ where: { name: "Lớp bảng bất biến" } })).id) as string };
    check("tạo lớp bảng bằng POST /api/courses (feeMode monthly_sheet)", created.status === 201 && (await prisma.course.findUniqueOrThrow({ where: { id: SC.id } })).feeMode === "monthly_sheet");
    const H1 = await mkIn("Em Bảng H1", [SC.id]), H2 = await mkIn("Em Bảng H2", [SC.id]);
    await prisma.tuitionOverride.create({ data: { userId: H2.id, pricePerSession: 30000, updatedBy: T1.id } }); // đơn giá riêng TOÀN CỤC của H2 cũng nằm trong bảng 'trước' → thêm vào sau khi chụp = hàng mới? Chụp lại bên dưới.
    for (const s of [F, G]) await prisma.enrollment.create({ data: { userId: s.id, courseId: SC.id, status: "active" } });
    const sheetStudents = [H1.id, H2.id, F.id, G.id];
    const before2 = await snap(); // sau khi dựng thêm hàng của H2 (đã tính là hàng 'trước' của mọi lớp khác)
    const cfg = await putCfg(SC.id, T1, { subjects: ["Toán", "Anh"], tiers: [{ subjects: 1, rate: 90000 }, { subjects: 2, rate: 80000 }], periodStartDay: 1 });
    check("đặt bảng bậc RIÊNG (90.000 / 80.000) cho lớp bảng → 200", cfg.status === 200);
    const text = tsv([{ "Họ tên": "Em Bảng H1", Toán: 4, Anh: 4 }, { "Họ tên": "Em Bảng H2", Toán: 2 }, { "Họ tên": "Em Học Hai Lớp F", Toán: 4 }, { "Họ tên": "Em Học Hai Lớp G", Anh: 3 }]);
    const ip = await prev(SC.id, T1, text);
    const ic = await conf(SC.id, T1, text, ip.json.fileHash);
    check("xem trước + xác nhận nhập: 4 dòng, đúng số theo bảng bậc RIÊNG (H1 2 môn 8×80.000 = 640.000; H2 2×90.000 = 180.000; F 4×90.000 = 360.000; G 3×90.000 = 270.000)", ic.status === 200 && ic.json.written === 4 && ic.json.totalNet === 640000 + 180000 + 360000 + 270000, ic.json);
    await putRow(SC.id, H2.id, T1, { sessions: { Toán: 3 } });
    await putRow(SC.id, G.id, T1, { sessions: { Anh: 3 }, scholarship: 20000 });
    await delRow(SC.id, G.id, T1);
    await putRow(SC.id, G.id, T1, { sessions: { Anh: 3 } });
    const ri = await issue(T1, YM, sheetStudents);
    check("lập phiếu cho 4 em của lớp bảng qua đường có sẵn (kỳ này) → 4 phiếu", ri.status === 201 && ri.json.created.length === 4, ri.json);
    const iF = await prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: F.id, yearMonth: YM } }), iG = await prisma.tuitionInvoice.findFirstOrThrow({ where: { studentId: G.id, yearMonth: YM } });
    const bF = iF.breakdown as any, bG = iG.breakdown as any;
    const oracleF = computeMonthlyFee({ subjects: [{ courseId: L1.id, courseName: "Toán cũ", sessionCount: 8, freeCount: 1 }, { courseId: L2.id, courseName: "Lý cũ", sessionCount: 4, freeCount: 0 }] });
    check("em học HAI lớp (F: 2 lớp cũ + lớp bảng): phần lớp cũ vẫn bậc 60.000 (lớp bảng KHÔNG tính thêm môn → không nhảy 55.000), gốc khớp công thức gốc 0 đồng; phần lớp bảng cộng riêng 360.000", bF.pricePerSession === 60000 && bF.perSubject.length === 2 && bF.gross === oracleF.gross && bF.chargesTotal === 360000 && iF.amountDue === oracleF.finalAmount + 360000, { price: bF.pricePerSession, gross: bF.gross, oracle: oracleF.gross, charges: bF.chargesTotal, due: iF.amountDue });
    const oracleG = computeMonthlyFee({ subjects: [{ courseId: L1.id, courseName: "Toán cũ", sessionCount: 8, freeCount: 1 }] });
    check("em G (1 lớp cũ + lớp bảng): bậc 70.000 (1 môn cũ), gốc khớp công thức gốc; phần lớp bảng 270.000", bG.pricePerSession === 70000 && bG.perSubject.length === 1 && bG.gross === oracleG.gross && bG.chargesTotal === 270000 && iG.amountDue === oracleG.finalAmount + 270000, { price: bG.pricePerSession, gross: bG.gross, charges: bG.chargesTotal });
    const sw = await prisma.courseTeacher.findFirst();
    void sw;
    // chốt buổi của lớp bảng không sinh phí theo buổi
    const sid = (await A("POST", `/api/courses/${SC.id}/attendance-sessions`, { as: T1, body: { date: nowKey } })).json.id as string;
    await prisma.attendanceSession.update({ where: { id: sid }, data: { state: "closed", closedAt: new Date(), closedBy: T1.id } });
    const cb = await prisma.feeCharge.count({ where: { courseId: SC.id } });
    const att = await A("PUT", `/api/attendance-sessions/${sid}`, { as: T1, body: { records: [{ userId: H1.id, status: "present" }, { userId: H2.id, status: "late" }] } });
    check("chốt buổi + điểm danh có mặt ở lớp bảng → KHÔNG sinh FeeCharge theo buổi (kiểu mới 'monthly_sheet' bị bỏ qua)", att.status === 200 && (await prisma.feeCharge.count({ where: { courseId: SC.id } })) === cb && (await prisma.feeCharge.count({ where: { courseId: SC.id, kind: "session" } })) === 0, att.json);
    // nhân bản lớp bảng
    const dup = await A("POST", `/api/courses/${SC.id}/duplicate`, { as: T1 });
    check("nhân bản lớp bảng → 200", dup.status === 200);

    // ── so sánh ──
    const after = await snap();
    const changed: string[] = [], added: string[] = [];
    for (const t of TABLES) {
      for (const [id, v] of before2[t]) { const a = after[t].get(id); if (!a || a.json !== v.json) changed.push(`${t}:${id}${a ? "" : " (mất)"}`); }
      for (const [id, v] of after[t]) {
        if (before2[t].has(id)) continue;
        const r = v.row;
        const sheetOwned = (t === "feeCharge" && r.courseId === SC.id) || (t === "tuitionInvoice" && sheetStudents.includes(r.studentId) && r.yearMonth === YM);
        if (!sheetOwned) added.push(`${t}:${id}`);
      }
    }
    check(`MỌI hàng của 9 bảng tiền có từ trước (tuition_invoices, fee_charges, monthly_course_fees, course_fee_rates, course_student_rates, student_discounts, tuition_overrides, session_packages, tuition_credits) GIỐNG HỆT từng byte (kể cả updatedAt) sau toàn bộ tính năng mới`, changed.length === 0, changed);
    check("KHÔNG hàng mới nào ngoài hàng của lớp bảng (fee_charges của lớp bảng; phiếu kỳ này của em lớp bảng); các bảng giá / giảm giá / gói buổi / MonthlyCourseFee không thêm dòng", added.length === 0 && (["monthlyCourseFee", "courseFeeRate", "courseStudentRate", "studentDiscount", "sessionPackage", "tuitionCredit"] as const).every(t => after[t].size === before2[t].size), added);
    const delta = Object.fromEntries(TABLES.map(t => [t, `${before2[t].size}→${after[t].size}`]));
    console.log("    số hàng trước→sau:", JSON.stringify(delta));
    console.log("    băm 'sau' các bảng không được thêm hàng:", (["monthlyCourseFee", "courseFeeRate", "courseStudentRate", "studentDiscount", "tuitionOverride", "sessionPackage", "tuitionCredit"] as const).map(t => `${t}=${hashOf(after[t])}${hashOf(after[t]) === hashOf(before2[t]) ? "=" : "≠"}`).join(" "));
    check("băm 7 bảng giá / giảm giá / gói buổi / tín dụng / override / MonthlyCourseFee TRƯỚC = SAU", (["monthlyCourseFee", "courseFeeRate", "courseStudentRate", "studentDiscount", "tuitionOverride", "sessionPackage", "tuitionCredit"] as const).every(t => hashOf(after[t]) === hashOf(before2[t])));
    const leg = ["Em A", "Em B", "Em C", "Em K"].length;
    check(`phiếu lớp cũ (nháp / đã gửi + tín dụng / đã đóng + giảm 10% + override / huỷ) và phiếu của thầy khác: không đổi (số tiền, trạng thái, breakdown, creditParts)`, leg === 4 && [sA, sB, sC, sK, sM, sD, sE].every(s => { const b = [...before2.tuitionInvoice.values()].find(v => v.row.studentId === s.id)!, a = [...after.tuitionInvoice.values()].find(v => v.row.id === b.row.id)!; return a.json === b.json; }));
    check("computeMonthlyFee / pricePerSessionVnd cho cùng kết quả cố định 70 / 60 / 55 / 50 / 50 (TUITION_TIER_VND chưa bị đụng)", fixed.price.join() === "70000,60000,55000,50000,50000" && pricePerSessionVnd(3) === 55000 && pricePerSessionVnd(2, 40000) === 40000 && stableStringify(TUITION_TIER_VND) === stableStringify({ 1: 70000, 2: 60000, 3: 55000, 4: 50000 }) && computeMonthlyFee({ subjects: [1, 2, 3].map(i => ({ courseId: `c${i}`, courseName: `c${i}`, sessionCount: 10, freeCount: 0 })) }).gross === 3 * 10 * 55000, fixed);
    let diff = "";
    try { const mb = execFileSync("git", ["merge-base", "HEAD", "origin/main"], { encoding: "utf8", cwd: process.cwd() }).trim(); diff = execFileSync("git", ["diff", "--name-only", mb, "--", "src/lib/tuition.ts", "src/lib/invoiceServer.ts", "src/lib/feeChargeServer.ts", "src/lib/sessionBookServer.ts", "src/lib/notify.ts"], { encoding: "utf8", cwd: process.cwd() }).trim(); } catch (e) { diff = `LỖI git: ${(e as Error).message.slice(0, 80)}`; }
    check("5 tệp KHÓA (tuition.ts, invoiceServer.ts, feeChargeServer.ts, sessionBookServer.ts, notify.ts) không có thay đổi nào so với nền origin/main", diff === "", diff);
  }

  check("KHÔNG phản hồi 5xx nào xuất hiện ngoài ca cố ý gây lỗi DB (mục 4)", serverErrors.length === 0, serverErrors.slice(0, 6));
  await done();
})().catch(async e => { console.error(e); try { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS hpl_boom_t ON course_fee_tables`); } catch { /* bỏ qua */ } process.exit(2); });
