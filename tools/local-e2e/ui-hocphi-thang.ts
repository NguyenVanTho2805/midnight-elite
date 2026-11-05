// HOCPHI-THEO-BUOI (mục 5.3, 8) — TRÌNH DUYỆT thật: /lop-cua-toi/hoc-phi/thang. 1280px (bảng + dòng tổng) và 390px (thẻ); ba trạng thái (tải / lỗi + Thử lại / rỗng + liên kết Lịch);
// đổi tháng bằng liên kết ?ym=; số tiền viết đầy đủ (không "tr", "k"); không tên học sinh; công tắc ẩn tiền che số; Tải CSV; liên kết từ trang Học phí; nút >= 44px.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-hocphi-thang.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnMonthKey } from "@/lib/revenue";

const shiftYm = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const i = y * 12 + (m - 1) + by; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const SMALL = `[...document.querySelectorAll('main a, main button, main select, main input')].filter(e => {
  const r = e.getBoundingClientRect();
  return e.offsetParent && r.height < 43.5 && !e.closest('nav[aria-label="Điều hướng"]') && !e.closest('nextjs-portal') && !e.closest('[data-kin-toast]') && e.getAttribute('aria-label') !== 'Mở rộng thanh bên';
}).map(e => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height))`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), OTHER = await mkTutor("Cô Khác");
  const cur = vnMonthKey(new Date()), prev = shiftYm(cur, -1);
  const toan = await mkCourse(T.id, { name: "Toán 9 bảng tháng" });
  await prisma.course.update({ where: { id: toan.id }, data: { feeMode: "per_session" } });
  const khac = await mkCourse(OTHER.id, { name: "Lớp của cô khác" });
  await prisma.course.update({ where: { id: khac.id }, data: { feeMode: "per_session" } });
  const A = await mkUser({ name: "Em Hiếu Bí Mật" }), B = await mkUser({ name: "Em Lan Bí Mật" }), X = await mkUser({ name: "Em Của Cô Khác" });
  const mk = (courseId: string, tutorId: string, studentId: string, ym: string, day: string, amount: number) =>
    prisma.feeCharge.create({ data: { tutorId, courseId, studentId, kind: "session", dateKey: `${ym}-${day}`, yearMonth: ym, amount, rate: amount, mode: "per_session" } });
  // Tháng này: 3 dòng = 450.000đ (hai em). Tháng trước: 1 dòng = 150.000đ → chênh +300.000đ (+200,0%).
  await mk(toan.id, T.id, A.id, cur, "01", 150000); await mk(toan.id, T.id, B.id, cur, "01", 150000); await mk(toan.id, T.id, A.id, cur, "02", 150000);
  await mk(toan.id, T.id, A.id, prev, "05", 150000);
  await mk(khac.id, OTHER.id, X.id, cur, "01", 999000);
  // Buổi đã chốt tháng này (để cột 'Buổi đã chốt' có số).
  for (const d of ["01", "02"]) await prisma.attendanceSession.create({ data: { courseId: toan.id, date: new Date(`${cur}-${d}T00:00:00Z`), createdBy: T.id, state: "closed" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };
  const bodyText = (p: any) => p.evaluate("document.body.innerText") as Promise<string>;

  section("1600px: bảng");
  const ctx = await ctxFor(T, { width: 1600, height: 1000 });
  const p = await ctx.newPage(); watch(p);
  await p.goto(`${BASE}/lop-cua-toi/hoc-phi/thang`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Học phí theo tháng", level: 1 }).waitFor({ timeout: 90000 });
  await p.locator("[data-hpt-state=ok]").waitFor({ timeout: 90000 });
  check("có bảng, dòng lớp của cô Lan, dòng tổng", await p.locator("table").isVisible() && (await p.locator("[data-hpt-row]").count()) === 1 && await p.locator("[data-hpt-total]").isVisible());
  const t = await bodyText(p);
  check("tháng này: 450.000đ; tháng trước 150.000đ; chênh +300.000đ (+200,0%) — số máy chủ trả, viết đầy đủ", t.includes("450.000đ") && t.includes("150.000đ") && t.includes("+300.000đ (+200,0%)"), t.slice(0, 600));
  check("KHÔNG thấy lớp / tiền của cô khác (999.000đ)", !t.includes("Lớp của cô khác") && !t.includes("999.000đ"));
  check("số tiền không viết tắt (không '1tr', '150k')", !/\d\s?(tr|k)\b/i.test(t), t.match(/\d\s?(tr|k)\b/i));
  check("không có tên học sinh", !/Bí Mật|Của Cô Khác/.test(t) && !(await p.content()).includes(A.id) && !(await p.content()).includes(B.id));
  check("chú thích 'trước học bổng và giảm giá' + nút Tải CSV", t.includes("trước học bổng và giảm giá") && await p.getByRole("link", { name: "Tải CSV" }).isVisible());
  check("không có nút xoá / sửa (chỉ đọc)", (await p.getByRole("button", { name: /Xoá|Sửa|Lưu/ }).count()) === 0);
  check("tháng sau chưa tới: không có liên kết sang tương lai, có chữ báo", (await p.getByRole("link", { name: new RegExp(`Tháng ${Number(shiftYm(cur, 1).slice(5))}/`) }).count()) === 0 && await p.getByText("Chưa tới tháng sau").isVisible());
  await shot(p, "hocphi-thang-1600");

  section("Ẩn tiền + CSV");
  await p.locator("[data-money-eye]").first().click();
  await eventually("ẩn tiền: số thay bằng •••••", async () => { const x = await bodyText(p); return !x.includes("450.000đ") && x.includes("•••••"); });
  await p.locator("[data-money-eye]").first().click();
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.getByRole("link", { name: "Tải CSV" }).click()]);
  const csv = await (await import("node:fs")).promises.readFile(await dl.path()!, "utf8");
  check("CSV tải được: có tên lớp, không có tên học sinh / lớp khác", csv.includes("Toán 9 bảng tháng") && !/Bí Mật|Của Cô Khác|Lớp của cô khác/.test(csv), csv.slice(0, 200));

  section("Đổi tháng bằng liên kết ?ym=");
  // Hai liên kết tháng có aria-label "Xem Tháng …" nên tên truy cập KHÔNG bắt đầu bằng "←": chọn theo vùng điều hướng.
  await p.getByRole("navigation", { name: "Chọn tháng" }).getByRole("link", { name: /^Xem / }).first().click();
  await p.waitForURL(new RegExp(`ym=${prev}$`), { timeout: 60000 });
  await p.locator("[data-hpt-state=ok]").waitFor({ timeout: 60000 });
  const t2 = await bodyText(p);
  check("tháng trước: 150.000đ, chênh 'Tháng trước chưa có' (không có tháng liền trước nữa)", t2.includes("150.000đ") && t2.includes("Tháng trước chưa có"), t2.slice(0, 400));
  check("liên kết → sang tháng này có mặt (tháng sau của tháng trước)", (await p.getByRole("navigation", { name: "Chọn tháng" }).getByRole("link", { name: /^Xem / }).count()) === 2 && /→$/.test((await p.getByRole("navigation", { name: "Chọn tháng" }).getByRole("link", { name: /^Xem / }).last().textContent()) ?? ""));
  const fut = await p.goto(`${BASE}/lop-cua-toi/hoc-phi/thang?ym=${shiftYm(cur, 2)}`, { waitUntil: "networkidle", timeout: 120000 });
  void fut;
  await p.locator("[data-hpt-state]").first().waitFor({ timeout: 60000 });
  check("?ym= ở tương lai → về tháng hiện tại (không xem được tương lai)", (await p.getByText(`Tháng ${Number(cur.slice(5))}/${cur.slice(0, 4)}`).first().isVisible()));

  section("Ba trạng thái: tải, lỗi, rỗng");
  const s = await (await ctxFor(T, { width: 1600, height: 1000 })).newPage(); watch(s);
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await s.route("**/api/tutor/hoc-phi-thang**", async route => { await gate; await route.continue(); });
  await s.goto(`${BASE}/lop-cua-toi/hoc-phi/thang`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await s.locator("[data-hpt-state=loading]").waitFor({ timeout: 90000 });
  check("đang tải: khung xương (aria-busy), chưa có bảng", await s.locator('[aria-busy="true"][aria-label="Đang tải học phí tháng"]').isVisible() && (await s.locator("table").count()) === 0);
  release(); await s.unroute("**/api/tutor/hoc-phi-thang**");
  await s.locator("[data-hpt-state=ok]").waitFor({ timeout: 60000 });
  let fail = true;
  await s.route("**/api/tutor/hoc-phi-thang**", route => fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Không tải được bảng học phí tháng" }) }) : route.continue());
  await s.goto(`${BASE}/lop-cua-toi/hoc-phi/thang`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const alert = s.locator("[data-hpt-state=error]");
  await alert.waitFor({ timeout: 60000 });
  check("lỗi: role=alert + nút Thử lại", (await alert.getAttribute("role")) === "alert" && await alert.getByRole("button", { name: "Thử lại" }).isVisible());
  fail = false;
  await alert.getByRole("button", { name: "Thử lại" }).click();
  await s.locator("[data-hpt-state=ok]").waitFor({ timeout: 60000 });
  check("Thử lại → có bảng", await s.locator("table").isVisible());
  await s.goto(`${BASE}/lop-cua-toi/hoc-phi/thang?ym=2025-01`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const empty = s.locator("[data-hpt-state=empty]");
  await empty.waitFor({ timeout: 60000 });
  check("rỗng: 'Tháng này chưa có buổi nào được chốt', gợi ý Đã dạy xong, liên kết Mở Lịch", await empty.getByText("Tháng này chưa có buổi nào được chốt").isVisible() && await empty.getByText(/Bấm Đã dạy xong/).isVisible() && (await empty.getByRole("link", { name: "Mở Lịch" }).getAttribute("href")) === "/lop-cua-toi/lich");

  section("Lối vào từ trang Học phí");
  const h = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(h);
  await h.goto(`${BASE}/lop-cua-toi/hoc-phi`, { waitUntil: "networkidle", timeout: 120000 });
  await h.getByRole("link", { name: "Học phí theo tháng" }).click();
  await h.waitForURL(/\/lop-cua-toi\/hoc-phi\/thang$/, { timeout: 60000 });
  check("liên kết 'Học phí theo tháng' dẫn tới trang mới", await h.getByRole("heading", { name: "Học phí theo tháng", level: 1 }).isVisible());
  check("thanh bên: một mục sáng (aria-current=page) trong phạm vi nhìn thấy", (await h.locator("[aria-current=page]:visible").count()) >= 1, await h.locator("[aria-current=page]:visible").allTextContents());

  section("Điện thoại 390px: thẻ");
  const m = await (await ctxFor(T, { width: 390, height: 844 })).newPage(); watch(m);
  await m.goto(`${BASE}/lop-cua-toi/hoc-phi/thang`, { waitUntil: "networkidle", timeout: 120000 });
  await m.locator("[data-hpt-state=ok]").waitFor({ timeout: 90000 });
  check("390px: thẻ lớp + thẻ tổng, không có bảng", (await m.locator("[data-hpt-card]:visible").count()) === 1 && await m.locator("[data-hpt-total-card]").isVisible() && !(await m.locator("table").isVisible()));
  const mt = await bodyText(m);
  check("390px: số đầy đủ, chênh '+300.000đ (+200,0%)', không tên em", mt.includes("450.000đ") && mt.includes("+300.000đ (+200,0%)") && !/Bí Mật/.test(mt) && !/\d\s?(tr|k)\b/i.test(mt));
  const small = await m.evaluate(SMALL) as string[];
  check("390px: không tràn ngang, nút / liên kết >= 44px", (await m.evaluate("document.documentElement.scrollWidth")) as number <= 390 && small.length === 0, small);
  await shot(m, "hocphi-thang-390");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
