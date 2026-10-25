// HP-31 — giao diện: "Gói buổi trả trước" ĐÃ ẨN theo quyết định của chủ 25/10/2026 (học xong mới thu học phí, không có gói trả trước).
// Mã (LopGoiBuoi, SessionPackages), API /api/courses/[id]/packages và hai bảng GIỮ NGUYÊN (t-session-package vẫn kiểm API), chỉ gỡ hai chỗ gắn vào trang:
//   - tab Học phí của lớp (gia sư), - "Sổ của con" (phụ huynh).
// Bài này trước kiểm giao diện lập gói / số dư / lịch sử / huỷ; nay giữ nguyên các bước dựng dữ liệu qua API (kể cả chốt buổi có gói còn dư, huỷ gói) và đổi kỳ vọng:
// dù DB CÓ gói, hai trang vẫn mở bình thường mà KHÔNG hiện mục gói buổi, không lộ tên em khác, 390px không tràn ngang.
import { randomBytes } from "node:crypto";
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

const COURSE_BASE = {
  category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/10/2026", types: ["Video"], tag: null, tagColor: null,
  bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)", price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
};

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const G = await mkUser({ name: "Trần Gia Bảo" }), H = await mkUser({ name: "Lê Minh Khang" });
  const cid = `gb-ui-${Date.now().toString(36)}`;
  const mk = await api("POST", "/api/courses", { as: T, body: { ...COURSE_BASE, id: cid, name: "Toán 9 theo buổi", adminName: "Toán 9 theo buổi", shortTitle: "T9", feeMode: "per_session", feeRate: 150_000 } });
  if (mk.status !== 201) throw new Error("tạo lớp lỗi " + JSON.stringify(mk.json));
  for (const u of [G, H]) await prisma.enrollment.create({ data: { userId: u.id, courseId: cid, status: "active" } });
  const legacy = await mkCourse(T.id, { name: "Lý cũ" });

  await launch();
  const ctx = await ctxFor(T, { width: 390, height: 844 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource|vietqr/i.test(m.text())) errors.push(m.text()); });
  const noGoiBuoi = async (p: typeof page) => (await p.locator("[data-goi-buoi], [data-goi-buoi-row]").count()) === 0
    && (await p.getByRole("heading", { name: "Gói buổi trả trước" }).count()) === 0 && (await p.getByRole("button", { name: "Lập gói…" }).count()) === 0;

  section("Lớp cũ: không có mục gói buổi");
  await page.goto(`${BASE}/lop-cua-toi/${legacy.id}?tab=hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Học phí và đối soát" }).waitFor({ timeout: 90000 });
  check("lớp tính theo số buổi trong tháng: KHÔNG có 'Gói buổi trả trước'", await noGoiBuoi(page));

  section("Lớp theo buổi: mục gói buổi đã ẩn, phần học phí còn nguyên");
  await page.goto(`${BASE}/lop-cua-toi/${cid}?tab=hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Học phí và đối soát" }).waitFor({ timeout: 90000 });
  check("tab Học phí của lớp theo buổi: KHÔNG có 'Gói buổi trả trước', không có nút 'Lập gói…', không có chữ 'Sổ buổi, không phải thu tiền'", await noGoiBuoi(page) && (await page.getByText("Sổ buổi, không phải thu tiền").count()) === 0);

  section("Dữ liệu gói vẫn dựng được qua API (API giữ nguyên) nhưng giao diện không hiện");
  const g1 = await api("POST", `/api/courses/${cid}/packages`, { as: T, body: { studentId: G.id, sessions: 5, note: "gói tháng 11" } });
  check("API lập gói vẫn chạy: 201, DB đúng 1 gói, 150.000 × 5 = 750.000", g1.status === 201 && (await prisma.sessionPackage.count()) === 1 && (await prisma.sessionPackage.findFirstOrThrow()).totalPrice === 750_000, g1.json);
  const d = addDaysKey(vnDateKeyOf(new Date()), -1);
  const sid = (await api("POST", `/api/courses/${cid}/attendance-sessions`, { as: T, body: { date: d } })).json.id as string;
  await api("PUT", `/api/attendance-sessions/${sid}`, { as: T, body: { records: [{ userId: G.id, status: "present" }, { userId: H.id, status: "present" }] } });
  await api("POST", `/api/courses/${cid}/sessions/${d}/close`, { as: T, body: { action: "close" } });
  check("chốt buổi vẫn trừ gói ở DB (đã dùng 1)", (await prisma.sessionPackageUse.count({ where: { reversedAt: null } })) === 1);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Học phí và đối soát" }).waitFor({ timeout: 90000 });
  check("có gói và đã trừ buổi trong DB, tab Học phí VẪN không hiện mục gói buổi (không 'đã dùng 1 · còn 4', không 'Huỷ gói')", await noGoiBuoi(page) && (await page.getByText(/còn 4/).count()) === 0 && (await page.getByRole("button", { name: "Huỷ gói" }).count()) === 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("390px: tab Học phí không tràn ngang", overflow <= 0, overflow);
  const cancel = await api("POST", `/api/courses/${cid}/packages/${g1.json.id}`, { as: T, body: { action: "cancel" } });
  check("API huỷ gói vẫn chạy: 200, DB 'cancelled'; buổi đã trừ vẫn còn trong sổ", cancel.status === 200 && (await prisma.sessionPackage.findFirstOrThrow()).status === "cancelled" && (await prisma.sessionPackageUse.count({ where: { reversedAt: null } })) === 1, cancel.status);

  section("Sổ của con: phụ huynh KHÔNG thấy mục gói buổi dù em có gói");
  const g2 = await api("POST", `/api/courses/${cid}/packages`, { as: T, body: { studentId: G.id, sessions: 3 } });
  const d2 = addDaysKey(vnDateKeyOf(new Date()), 0);
  const sid2 = (await api("POST", `/api/courses/${cid}/attendance-sessions`, { as: T, body: { date: d2 } })).json.id as string;
  await api("PUT", `/api/attendance-sessions/${sid2}`, { as: T, body: { records: [{ userId: G.id, status: "late" }] } });
  await api("POST", `/api/courses/${cid}/sessions/${d2}/close`, { as: T, body: { action: "close" } });
  const PG = await mkUser({ name: "Phụ huynh Bảo" }), PH = await mkUser({ name: "Phụ huynh Khang" });
  const tok = async (p: { id: string }, s: { id: string }) => { const t = randomBytes(16).toString("hex"); await prisma.parentLink.create({ data: { parentId: p.id, studentId: s.id, status: "verified", verifiedAt: new Date(), portalToken: t } }); return t; };
  const tG = await tok(PG, G), tH = await tok(PH, H);
  const pctx = await ctxFor(null, { width: 390, height: 844 });
  const pp = await pctx.newPage();
  await pp.goto(`${BASE}/so-cua-con/${tG}`, { waitUntil: "networkidle", timeout: 120000 });
  await pp.getByText(/Sổ của con: Trần Gia Bảo/).first().waitFor({ timeout: 90000 });
  check("Sổ của con (Bảo, có gói 3 buổi trong DB): trang mở bình thường, KHÔNG có mục 'Gói buổi trả trước', không có 'Gói 3 buổi'", g2.status === 201 && (await pp.locator("[data-session-packages]").count()) === 0 && (await pp.getByRole("heading", { name: "Gói buổi trả trước" }).count()) === 0 && (await pp.getByText(/Gói 3 buổi/).count()) === 0);
  check("không còn dòng 'không phải hoá đơn hay xác nhận thanh toán' của mục gói buổi", (await pp.getByText(/không phải hoá đơn hay xác nhận thanh toán/).count()) === 0);
  const body = await pp.locator("body").innerText();
  check("không lộ tên em khác trong lớp", !body.includes("Lê Minh Khang"));
  check("390px không tràn ngang", (await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  const pp2 = await pctx.newPage();
  await pp2.goto(`${BASE}/so-cua-con/${tH}`, { waitUntil: "networkidle", timeout: 120000 });
  await pp2.getByText(/Kính gửi/).first().waitFor({ timeout: 90000 });
  check("phụ huynh em KHÁC (Khang, chưa có gói) cũng không thấy mục gói buổi", (await pp2.locator("[data-session-packages]").count()) === 0);
  section("1440px");
  const wctx = await ctxFor(T, { width: 1440, height: 900 });
  const wp = await wctx.newPage();
  await wp.goto(`${BASE}/lop-cua-toi/${cid}?tab=hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await wp.getByRole("heading", { name: "Học phí và đối soát" }).waitFor({ timeout: 90000 });
  check("1440px: tab Học phí không có mục gói buổi, không tràn ngang", await noGoiBuoi(wp) && (await wp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  check("không lỗi trình duyệt", errors.length === 0, errors);
  await closeAll();
  await done();
})();
