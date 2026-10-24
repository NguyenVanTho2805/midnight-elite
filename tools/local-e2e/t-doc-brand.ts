// KiN Pro F3 — giấy tờ có thương hiệu (báo cáo tháng): API + DB + trang in. Cờ cổng là biến môi trường của MÁY CHỦ nên chạy hai lần:
//   EXPECT_ENFORCE=0 (máy chủ mặc định, cổng TẮT)  ·  EXPECT_ENFORCE=1 (máy chủ chạy với KIN_PLAN_ENFORCE=1)   — xem tools/local-e2e/doc-brand-run.sh
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const v = process.env.EXPECT_ENFORCE;
if (v !== "0" && v !== "1") throw new Error("Đặt EXPECT_ENFORCE=0 hoặc 1 (cờ mà máy chủ đang chạy).");
const ENFORCE = v === "1";
const YM = "2026-09";
const DAY = 86_400_000;
let seq = 0;
const BASE_PATH = "/lop-cua-toi/bao-cao-thang/in";

async function mkPro(u: TUser, endOffsetDays: number) {
  await prisma.proOrder.create({ data: { userId: u.id, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 79000, source: "admin_grant", memoCode: `KINPRO-F3${++seq}${Date.now().toString(36)}`.slice(0, 20).toUpperCase(), status: "active", startDate: new Date(Date.now() - 40 * DAY), endDate: new Date(Date.now() + endOffsetDays * DAY) } });
}
async function approve(T: TUser, s: TUser, text = "Cô sẽ xem lại phần hình học.") {
  return api("POST", `/api/tutor/monthly-reports/${s.id}/approve?yearMonth=${YM}`, { as: T, body: { items: [{ text, kind: "tu-viet" }] } });
}
// Trang gia sư có loading.tsx nên máy chủ phát luồng: trạng thái HTTP luôn 200, notFound() hiện qua thẻ noindex, redirect() qua <meta refresh>. Kiểm theo NỘI DUNG.
const paper = (html: string) => { const i = html.indexOf("kin-print"); return i < 0 ? "" : html.slice(i, html.indexOf("</article>", i)); };
const isNotFound = (r: { text: string }) => r.text.includes("noindex") && paper(r.text) === "";
const redirectsTo = (r: { text: string }, path: string) => r.text.includes('http-equiv="refresh"') && r.text.includes(`url=${path}`) && paper(r.text) === "";
const brandBody = { displayName: "Lớp Toán cô Lan", accent: "luc", signature: "Chúc em tiến bộ mỗi ngày" };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Free"), TP = await mkTutor("Cô Pro"), TX = await mkTutor("Cô Hết Hạn"), T2 = await mkTutor("Thầy Khác");
  const toanT = await mkCourse(T.id, { name: "Toán 9" }), toanP = await mkCourse(TP.id, { name: "Toán 9 Pro" }), toanX = await mkCourse(TX.id, { name: "Toán 9 HH" }), lyOther = await mkCourse(T2.id, { name: "Lý 9" });
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" }), C = await mkUser({ name: "Chi Chi" }), D = await mkUser({ name: "Duy Dũng" });
  for (const [u, c] of [[A, toanT], [A, toanP], [B, toanP], [C, toanX], [D, toanX], [A, lyOther]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await mkPro(TP, 20);
  const stu = await mkUser();
  const anyone = await mkUser({ name: "Người lạ" });

  section(`Chế độ máy chủ: cổng ${ENFORCE ? "BẬT" : "TẮT"}`);
  const plan = await api("GET", "/api/tutor/goi", { as: T });
  check("máy chủ đúng chế độ", plan.status === 200 && plan.json.plan.enforced === ENFORCE, plan.json?.plan?.enforced);

  section("Quyền vào API cài đặt thương hiệu");
  check("chưa đăng nhập 401 · học sinh 403", (await api("GET", "/api/tutor/doc-brand")).status === 401 && (await api("GET", "/api/tutor/doc-brand", { as: stu })).status === 403 && (await api("PUT", "/api/tutor/doc-brand", { as: stu, body: brandBody })).status === 403);
  const g0 = await api("GET", "/api/tutor/doc-brand", { as: T });
  check(`GET: chưa cài (null); canBrand = ${!ENFORCE} cho Free`, g0.status === 200 && g0.json.brand === null && g0.json.canBrand === !ENFORCE, g0.json);

  section("Kiểm dữ liệu (cả Free lẫn Pro, trước cổng gói)");
  const bad = async (b: unknown) => (await api("PUT", "/api/tutor/doc-brand", { as: TP, body: b })).status;
  check("màu mã hex → 400 · tên trống → 400 · tên 'đã xác minh' → 400 · chữ ký quá dài → 400", await bad({ ...brandBody, accent: "#ff0000" }) === 400 && await bad({ ...brandBody, displayName: "" }) === 400 && await bad({ ...brandBody, displayName: "Trung tâm đã xác minh" }) === 400 && await bad({ ...brandBody, signature: "x".repeat(200) }) === 400);
  check("thân không phải JSON → 400", (await api("PUT", "/api/tutor/doc-brand", { as: TP, raw: "not-json", headers: { "content-type": "application/json" } })).status === 400);
  check("chưa lưu gì sau các lần sai", (await prisma.tutorDocBrand.count()) === 0);

  section("Lưu thương hiệu: Pro luôn được; Free chỉ khi cổng TẮT");
  const putFree = await api("PUT", "/api/tutor/doc-brand", { as: T, body: brandBody });
  if (ENFORCE) check("Free + cổng bật → 403 mã pro_required, không ghi DB", putFree.status === 403 && putFree.json.code === "pro_required" && (await prisma.tutorDocBrand.findUnique({ where: { userId: T.id } })) === null, putFree.json);
  else check("cổng TẮT: Free lưu được (không chặn ai) → 200", putFree.status === 200 && (await prisma.tutorDocBrand.findUnique({ where: { userId: T.id } }))?.displayName === brandBody.displayName, putFree.json);
  const putPro = await api("PUT", "/api/tutor/doc-brand", { as: TP, body: brandBody });
  check("Pro lưu được → 200, DB đúng, màu là KHOÁ (không phải mã màu)", putPro.status === 200 && (await prisma.tutorDocBrand.findUnique({ where: { userId: TP.id } }))?.accent === "luc", putPro.json);
  const getPro = await api("GET", "/api/tutor/doc-brand", { as: TP });
  check("Pro đọc lại đúng và canBrand = true", getPro.json.brand?.displayName === brandBody.displayName && getPro.json.canBrand === true, getPro.json);
  check("gia sư khác không đọc được thương hiệu của người khác (GET chỉ trả của chính mình)", (await api("GET", "/api/tutor/doc-brand", { as: T2 })).json.brand === null);

  section("Tạo bản in có thương hiệu: chưa duyệt → 409");
  check("báo cáo chưa duyệt → 409 (kể cả Pro)", (await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=${YM}`, { as: TP })).status === 409);
  check("chưa đăng nhập 401 · học sinh 403", (await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=${YM}`)).status === 401 && (await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=${YM}`, { as: stu })).status === 403);
  check("yearMonth hỏng 400 · tháng tương lai 400", (await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=2026-13`, { as: TP })).status === 400 && (await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=2099-01`, { as: TP })).status === 400);

  for (const [t, s] of [[T, A], [TP, A], [TP, B], [TX, C], [TX, D]] as const) check(`duyệt báo cáo ${t.name}/${s.name} (cách cũ vẫn chạy)`, (await approve(t, s)).status === 200);
  const rep = (t: TUser, s: TUser) => prisma.monthlyReport.findUnique({ where: { tutorId_studentId_yearMonth: { tutorId: t.id, studentId: s.id, yearMonth: YM } } });

  section("Quyền theo lớp: gia sư lạ 404, không lộ");
  const x = await api("POST", `/api/tutor/monthly-reports/${anyone.id}/branded?yearMonth=${YM}`, { as: T2 });
  check("học sinh không học lớp của gia sư này → 404", x.status === 404);
  check("gia sư Free không đụng được báo cáo của Pro: 404", (await api("POST", `/api/tutor/monthly-reports/${B.id}/branded?yearMonth=${YM}`, { as: T })).status === 404);

  section("Free (gia sư T)");
  const f1 = await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=${YM}`, { as: T });
  if (ENFORCE) {
    check("cổng bật: tạo bản thương hiệu → 403 pro_required, không ghi snapshot", f1.status === 403 && f1.json.code === "pro_required" && (await rep(T, A))?.brandSnapshot == null && (await rep(T, A))?.brandedAt == null, f1.json);
    check("đo: ghi 'gate_blocked'", (await prisma.usageEvent.count({ where: { userId: T.id, kind: "gate_blocked", refType: "branded_docs" } })) === 1);
  } else {
    check("cổng TẮT, Free đã lưu thương hiệu: tạo được → 200 và ghi snapshot", f1.status === 200 && f1.json.existing === false && (await rep(T, A))?.brandedAt != null, f1.json);
    check("đo bóng: ghi 'gate_would_block' cho Free", (await prisma.usageEvent.count({ where: { userId: T.id, kind: "gate_would_block", refType: "branded_docs" } })) === 1);
  }
  const dF = await api("GET", `/api/tutor/monthly-reports/${A.id}?yearMonth=${YM}`, { as: T });
  check("Free VẪN xem báo cáo, tạo, duyệt, có văn bản xuất; canBrand đúng cờ", dF.status === 200 && dF.json.report.approved === true && typeof dF.json.text === "string" && dF.json.text.includes("Minh Anh") && dF.json.canBrand === !ENFORCE, dF.json?.canBrand);
  const pFree = await api("GET", `${BASE_PATH}/${A.id}?yearMonth=${YM}&mau=kin`, { as: T });
  check("Free in được mẫu KiN (200), có chân trang 'Ghi trên KiN', không có tên thương hiệu", pFree.status === 200 && pFree.text.includes("Ghi trên KiN") && !pFree.text.includes(brandBody.displayName) && pFree.text.includes("Minh Anh"));

  section("Pro (gia sư TP)");
  const p1 = await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=${YM}`, { as: TP });
  const rA = await rep(TP, A);
  check("tạo → 200, snapshot lưu tên/màu/chữ ký (không phải tham chiếu sống)", p1.status === 200 && p1.json.existing === false && (rA?.brandSnapshot as { displayName?: string; accent?: string } | null)?.displayName === brandBody.displayName && (rA?.brandSnapshot as { accent?: string }).accent === "luc", rA?.brandSnapshot);
  const p2 = await api("POST", `/api/tutor/monthly-reports/${A.id}/branded?yearMonth=${YM}`, { as: TP });
  check("gọi lại → 200 existing, brandedAt không đổi", p2.status === 200 && p2.json.existing === true && (await rep(TP, A))?.brandedAt?.getTime() === rA?.brandedAt?.getTime());
  check("đo: 1 dòng 'branded_report'", (await prisma.usageEvent.count({ where: { userId: TP.id, kind: "branded_report" } })) === 1);
  await api("PUT", "/api/tutor/doc-brand", { as: TP, body: { displayName: "Tên Mới Sau Này", accent: "muc", signature: "" } });
  const printPro = await api("GET", `${BASE_PATH}/${A.id}?yearMonth=${YM}`, { as: TP });
  check("sửa thương hiệu SAU khi tạo không đổi bản đã tạo (đóng băng): bản in vẫn tên cũ", printPro.status === 200 && printPro.text.includes(brandBody.displayName) && !printPro.text.includes("Tên Mới Sau Này"));
  check("bản in có: tên học sinh, chữ ký, 'Ghi trên KiN' (không che được), dòng nhắc gửi riêng", printPro.text.includes("Minh Anh") && printPro.text.includes(brandBody.signature) && printPro.text.includes("Ghi trên KiN") && printPro.text.includes("không đăng vào nhóm chung"));
  check("bản in có đủ nội dung giấy (không rỗng)", paper(printPro.text).length > 500);
  check("tờ giấy không có từ cấm (đã xác minh / đúng luật / miễn thuế / đã gửi / Midnight Elite) và không có mã hex", !/đã xác minh|đúng luật|miễn thuế|đã gửi|Midnight Elite/i.test(paper(printPro.text)) && !/#[0-9a-f]{3,8}\b/i.test(paper(printPro.text)), paper(printPro.text).slice(0, 300));
  check("tờ giấy không chứa tiền / học phí", !/học phí|\d[\d.]*\s?(đ|₫|VND)\b/i.test(paper(printPro.text)));
  check("?mau=kin ép về mẫu KiN dù đã có thương hiệu", !(await api("GET", `${BASE_PATH}/${A.id}?yearMonth=${YM}&mau=kin`, { as: TP })).text.includes(brandBody.displayName));

  section("HẾT HẠN Pro (gia sư TX): bản đã tạo vẫn xem, chỉ chặn tạo MỚI");
  await mkPro(TX, 20);
  await api("PUT", "/api/tutor/doc-brand", { as: TX, body: { displayName: "Lớp Cô Hết Hạn", accent: "xanh-link", signature: "" } });
  check("khi còn Pro: tạo bản cho Chi Chi → 200", (await api("POST", `/api/tutor/monthly-reports/${C.id}/branded?yearMonth=${YM}`, { as: TX })).status === 200);
  await prisma.proOrder.updateMany({ where: { userId: TX.id }, data: { endDate: new Date(Date.now() - 2 * DAY) } });
  const dX = await api("GET", `/api/tutor/monthly-reports/${C.id}?yearMonth=${YM}`, { as: TX });
  check("hết hạn: GET báo cáo vẫn 200, brandedAt còn, canBrand " + (ENFORCE ? "false" : "true (cổng tắt)"), dX.status === 200 && dX.json.report.brandedAt != null && dX.json.canBrand === !ENFORCE, dX.json?.canBrand);
  const px = await api("GET", `${BASE_PATH}/${C.id}?yearMonth=${YM}`, { as: TX });
  check("hết hạn: trang in bản cũ VẪN mở và vẫn mang thương hiệu cũ", px.status === 200 && px.text.includes("Lớp Cô Hết Hạn") && px.text.includes("Ghi trên KiN"));
  check("hết hạn: gọi lại tạo cho bản cũ → 200 existing (không đòi Pro)", (await api("POST", `/api/tutor/monthly-reports/${C.id}/branded?yearMonth=${YM}`, { as: TX })).json?.existing === true);
  const nx = await api("POST", `/api/tutor/monthly-reports/${D.id}/branded?yearMonth=${YM}`, { as: TX });
  const pxd = await api("PUT", "/api/tutor/doc-brand", { as: TX, body: { displayName: "Sửa Sau Hết Hạn", accent: "muc", signature: "" } });
  if (ENFORCE) {
    check("hết hạn + cổng bật: tạo bản MỚI cho Duy Dũng → 403, không ghi", nx.status === 403 && nx.json.code === "pro_required" && (await rep(TX, D))?.brandSnapshot == null, nx.json);
    check("hết hạn + cổng bật: sửa thương hiệu → 403; thương hiệu cũ còn nguyên", pxd.status === 403 && (await prisma.tutorDocBrand.findUnique({ where: { userId: TX.id } }))?.displayName === "Lớp Cô Hết Hạn");
  } else {
    check("cổng TẮT: hết hạn cũng không bị chặn (tạo mới → 200)", nx.status === 200 && pxd.status === 200);
  }
  check("hết hạn vẫn tải được dữ liệu báo cáo (văn bản xuất) và duyệt lại được", dX.json.text.includes("Chi Chi") && (await approve(TX, C, "Dòng mới sau hết hạn")).status === 200);
  check("duyệt lại không xoá bản đã tạo (vẫn in được thương hiệu)", (await api("GET", `${BASE_PATH}/${C.id}?yearMonth=${YM}`, { as: TX })).text.includes("Lớp Cô Hết Hạn"));

  section("Trang in: quyền và trạng thái");
  check("chưa có bản ghi báo cáo nào → không tìm thấy (noindex), không có tờ giấy", isNotFound(await api("GET", `${BASE_PATH}/${B.id}?yearMonth=2026-08`, { as: TP })));
  await prisma.monthlyReport.create({ data: { tutorId: TP.id, studentId: B.id, yearMonth: "2026-08", draftItems: [] } });
  const pnd = await api("GET", `${BASE_PATH}/${B.id}?yearMonth=2026-08`, { as: TP });
  check("bản nháp chưa duyệt → 200 'chưa được duyệt', không có chân trang báo cáo", pnd.status === 200 && pnd.text.includes("chưa được duyệt") && paper(pnd.text) === "");
  check("gia sư khác mở báo cáo của người khác → 404 (A cũng học lớp của T2 nhưng báo cáo thuộc T/TP)", isNotFound(await api("GET", `${BASE_PATH}/${A.id}?yearMonth=${YM}`, { as: T2 })));
  check("chưa đăng nhập → chuyển sang /dang-nhap, không có tờ giấy", redirectsTo(await api("GET", `${BASE_PATH}/${A.id}?yearMonth=${YM}`), "/dang-nhap"));
  const ps = await api("GET", `${BASE_PATH}/${A.id}?yearMonth=${YM}`, { as: stu });
  check("học sinh mở trang in → bị chuyển khỏi khu gia sư, không thấy tờ giấy", redirectsTo(ps, "/lop-cua-toi") && !ps.text.includes("Điều chưa đạt tháng này"));
  check("yearMonth hỏng → không tìm thấy", isNotFound(await api("GET", `${BASE_PATH}/${A.id}?yearMonth=abc`, { as: TP })));

  section("Phụ huynh/học sinh không thấy lời mời Pro hay thương hiệu trên báo cáo của con");
  const tokP = (Date.now().toString(16).padStart(16, "0").slice(-16) + "00000000000000a1").slice(-32);
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "Chị Hoa" })).id, studentId: A.id, status: "verified", verifiedAt: new Date(), portalToken: tokP } });
  const portal = await api("GET", `/api/parent-portal/${tokP}`);
  check("API Sổ của con: 200, có báo cáo đã duyệt, KHÔNG có Pro/brandSnapshot/lời mời nâng cấp", portal.status === 200 && !/KiN Pro|brandSnapshot|brandedAt|docBrand|nâng cấp|Nâng cấp|goi\b/i.test(portal.text), portal.text.slice(0, 200));
  const page = await api("GET", `/so-cua-con/${tokP}`);
  check("trang Sổ của con: không chữ 'KiN Pro' / 'nâng cấp'", page.status === 200 && !/KiN Pro|nâng cấp|Nâng cấp/.test(page.text));

  section("Cổng không phá đường khác");
  check("danh sách báo cáo của Free vẫn tải được", (await api("GET", `/api/tutor/monthly-reports?yearMonth=${YM}`, { as: T })).status === 200);
  check("nhắn Zalo (ghi mở Zalo) của báo cáo đã duyệt vẫn chạy cho Free", (await api("POST", `/api/tutor/monthly-reports/${A.id}/zalo?yearMonth=${YM}`, { as: T })).status === 200);
  done();
})().catch(e => { console.error(e); process.exit(1); });
