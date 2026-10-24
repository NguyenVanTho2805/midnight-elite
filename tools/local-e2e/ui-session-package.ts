// HP-31 — giao diện: "Gói buổi trả trước" trong tab Học phí của lớp kiểu mới (lập gói có hộp xác nhận, số dư, lịch sử, huỷ), lớp cũ KHÔNG có mục này,
// và "Sổ của con" của phụ huynh hiện đúng gói của đúng em (chỉ trình bày, không giá). 390px không tràn ngang, nút ≥ 44px.
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

  section("Lớp cũ không có mục gói buổi");
  await page.goto(`${BASE}/lop-cua-toi/${legacy.id}?tab=hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Học phí và đối soát" }).waitFor({ timeout: 90000 });
  check("lớp tính theo số buổi trong tháng: KHÔNG có 'Gói buổi trả trước'", (await page.locator("[data-goi-buoi]").count()) === 0);

  section("Lớp theo buổi: trạng thái rỗng, lập gói");
  await page.goto(`${BASE}/lop-cua-toi/${cid}?tab=hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Gói buổi trả trước" }).waitFor({ timeout: 90000 });
  await page.getByText("Chưa có gói buổi nào").waitFor();
  check("trạng thái rỗng có lời giải thích; khung nói thật 'Sổ buổi, không phải thu tiền'", (await page.getByText("Sổ buổi, không phải thu tiền").count()) === 1 && (await page.getByText(/kế toán duyệt trước khi dùng thật/).count()) >= 1);
  await page.getByLabel("Em lập gói").selectOption({ label: "Trần Gia Bảo" });
  await page.getByLabel(/Số buổi \(1–200\)/).fill("5");
  await page.getByLabel("Ghi chú gói (tuỳ chọn)").fill("gói tháng 11");
  await page.getByRole("button", { name: "Lập gói…" }).click();
  const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await dlg.first().waitFor({ timeout: 15000 });
  check("hộp xác nhận nói rõ chỉ là sổ theo dõi, KiN không thu tiền; chưa ghi gì", (await dlg.first().innerText()).includes("KiN không thu tiền") && (await prisma.sessionPackage.count()) === 0);
  await dlg.first().getByRole("button", { name: "Giữ nguyên" }).click();
  check("'Giữ nguyên' không ghi gì", (await prisma.sessionPackage.count()) === 0);
  await page.getByRole("button", { name: "Lập gói…" }).click();
  await dlg.first().getByRole("button", { name: "Lập gói", exact: true }).click();
  await page.locator("[data-goi-buoi-row]").first().waitFor({ timeout: 30000 });
  const row = page.locator("[data-goi-buoi-row]").first();
  const rowText = await row.innerText();
  check("gói hiện: tên em, 'Gói 5 buổi · đã dùng 0 · còn 5', 'Còn buổi', giá ghi lúc lập chỉ để ghi lại", rowText.includes("Trần Gia Bảo") && rowText.includes("Gói 5 buổi") && rowText.includes("đã dùng 0") && rowText.includes("còn 5") && rowText.includes("Còn buổi") && rowText.includes("750.000đ") && rowText.includes("KiN không thu"), rowText);
  check("DB: đúng 1 gói, 150.000 × 5 = 750.000", (await prisma.sessionPackage.count()) === 1 && (await prisma.sessionPackage.findFirstOrThrow()).totalPrice === 750_000);

  section("Trừ buổi sau khi chốt, lịch sử, huỷ");
  const d = addDaysKey(vnDateKeyOf(new Date()), -1);
  const sid = (await api("POST", `/api/courses/${cid}/attendance-sessions`, { as: T, body: { date: d } })).json.id as string;
  await api("PUT", `/api/attendance-sessions/${sid}`, { as: T, body: { records: [{ userId: G.id, status: "present" }, { userId: H.id, status: "present" }] } });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-goi-buoi-row]").first().waitFor({ timeout: 60000 });
  check("buổi CHƯA chốt: vẫn 'còn 5' (lưu điểm danh không trừ)", (await page.locator("[data-goi-buoi-row]").first().innerText()).includes("còn 5"));
  await api("POST", `/api/courses/${cid}/sessions/${d}/close`, { as: T, body: { action: "close" } });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-goi-buoi-row]").first().waitFor({ timeout: 60000 });
  check("sau khi chốt: 'đã dùng 1 · còn 4'", (await page.locator("[data-goi-buoi-row]").first().innerText()).includes("đã dùng 1") && (await page.locator("[data-goi-buoi-row]").first().innerText()).includes("còn 4"));
  await page.getByRole("button", { name: /Xem lịch sử \(1\)/ }).click();
  const hist = await page.locator("[data-goi-buoi-uses]").innerText();
  check("lịch sử: ngày buổi và nhắc 'có khoản học phí cùng buổi, chưa vào phiếu' (nguy cơ tính hai lần được nói thẳng)", hist.includes(`${d.slice(8, 10)}/${d.slice(5, 7)}`) && hist.includes("Có khoản học phí cùng buổi, chưa vào phiếu"), hist);
  const box = await page.getByRole("button", { name: "Huỷ gói" }).first().boundingBox();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("390px: không tràn ngang; nút ≥ 44px", overflow <= 0 && !!box && box.height >= 44, { overflow, h: box?.height });
  await page.getByRole("button", { name: "Huỷ gói" }).first().click();
  await dlg.first().getByRole("button", { name: "Huỷ gói" }).click();
  await page.getByText("Đã huỷ", { exact: true }).first().waitFor({ timeout: 30000 });
  check("huỷ gói: trạng thái 'Đã huỷ' bằng chữ; DB 'cancelled'; buổi đã trừ vẫn còn trong sổ", (await prisma.sessionPackage.findFirstOrThrow()).status === "cancelled" && (await prisma.sessionPackageUse.count({ where: { reversedAt: null } })) === 1);

  section("Sổ của con: phụ huynh thấy đúng gói của đúng em");
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
  await pp.getByRole("heading", { name: "Gói buổi trả trước" }).waitFor({ timeout: 90000 });
  const sec = await pp.locator("[data-session-packages]").innerText();
  check("Sổ của con (Bảo): gói 3 buổi, đã dùng 1, còn 2; KHÔNG gói đã huỷ; KHÔNG giá", g2.status === 201 && sec.includes("Gói 3 buổi") && sec.includes("đã dùng 1") && sec.includes("còn 2") && !sec.includes("Gói 5 buổi") && !/\d\.\d{3}đ|đ\b/.test(sec), sec);
  check("có dòng nói thật 'chỉ trình bày, không phải hoá đơn hay xác nhận thanh toán'", (await pp.getByText(/không phải hoá đơn hay xác nhận thanh toán/).count()) === 1);
  const body = await pp.locator("body").innerText();
  check("không lộ tên em khác trong lớp", !body.includes("Lê Minh Khang"));
  check("390px không tràn ngang", (await pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  const pp2 = await pctx.newPage();
  await pp2.goto(`${BASE}/so-cua-con/${tH}`, { waitUntil: "networkidle", timeout: 120000 });
  await pp2.getByText(/Kính gửi/).first().waitFor({ timeout: 90000 });
  check("phụ huynh em KHÁC (Khang, chưa có gói) không thấy mục gói buổi", (await pp2.locator("[data-session-packages]").count()) === 0);
  section("1440px");
  const wctx = await ctxFor(T, { width: 1440, height: 900 });
  const wp = await wctx.newPage();
  await wp.goto(`${BASE}/lop-cua-toi/${cid}?tab=hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await wp.locator("[data-goi-buoi-row]").first().waitFor({ timeout: 90000 });
  check("1440px: sổ gói buổi hiện đủ, không tràn ngang", (await wp.locator("[data-goi-buoi-row]").count()) === 2 && (await wp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  check("không lỗi trình duyệt", errors.length === 0, errors);
  await closeAll();
  await done();
})();
