// ĐX-04 (NC1-054) — trang quản trị "Số đo sản phẩm" trên trình duyệt: sáu thẻ, mẫu số + định nghĩa, "chưa đủ dữ liệu", menu, lỗi + Thử lại, điện thoại.
// Cần Postgres + Next dev + Playwright (xem README).
import { BASE, mkTutor, mkUser, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";
import { generatePortalToken } from "@/lib/parentPortal";

const DAY = 86_400_000;
const KEYS = ["zaloOpened", "parentViewed", "paidIn14", "bank", "timely", "tutors"] as const;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), SA = await mkSuper("Quản trị");
  const students = []; for (let i = 0; i < 12; i++) students.push(await mkUser({ name: `Học sinh ${i}` }));

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|Hydration|favicon/i.test(m.text())) errors.push(m.text()); }); };

  section("Chưa có dữ liệu: mọi chỉ số ghi 'chưa đủ dữ liệu', không hiện phần trăm");
  const ctx = await ctxFor(SA);
  const p = await ctx.newPage(); watch(p);
  await p.goto(`${ADMIN}/admin/so-do`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Số đo sức khoẻ sản phẩm", level: 1 }).waitFor({ timeout: 90000 });
  for (const k of KEYS) await p.locator(`[data-metric="${k}"]`).waitFor({ timeout: 30000 });
  check("đủ sáu thẻ", (await p.locator("[data-metric]").count()) === 6);
  check("mỗi thẻ có định nghĩa và dòng 'Mẫu số:' ngay trên màn", (await p.getByText(/^Mẫu số:/).count()) === 6 && (await p.locator('[data-testid^="dn-"]').count()) === 6);
  check("bốn thẻ tỉ lệ (1, 2, 3, 5) ghi 'Chưa đủ dữ liệu' (0 mẫu), số lớn là '—'", (await p.getByText("Chưa đủ dữ liệu", { exact: true }).count()) >= 4 && (await p.locator('[data-testid="so-zaloOpened"]').innerText()) === "—");
  check("không thẻ nào hiện phần trăm khi chưa đủ mẫu", (await p.locator('[data-testid^="so-"]').allInnerTexts()).every(t => !/%/.test(t)));
  check("khoản tiền: ghi 'không có khoản nào đang chờ'", await p.getByText("Hiện không có khoản nào đang chờ gia sư.").isVisible());
  check("có dòng khoảng ngày và giờ tính", /Khoảng \d{2}\/\d{2} – \d{2}\/\d{2} · tính lúc/.test(await p.getByTestId("khoang").innerText()));

  section("Có dữ liệu: 12 phiếu, 10 đã mở Zalo → 83%; phiếu chỉ gửi nhóm không làm tụt chỉ số 2");
  const recent = new Date(Date.now() - 3 * DAY);
  for (let i = 0; i < 12; i++) {
    const priv = i < 8, group = i >= 8 && i < 10;
    await prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId: T.id, studentId: students[i].id, yearMonth: "2026-10", amountDue: 1_200_000, status: "sent", sentAt: recent,
      zaloOpenedAt: priv || group ? recent : null, ...(priv ? { viewToken: generatePortalToken(), viewTokenExpiresAt: new Date(Date.now() + 20 * DAY), parentViewedAt: i < 4 ? recent : null } : {}) } as never });
  }
  for (let i = 0; i < 3; i++) await prisma.bankTransaction.create({ data: { tutorId: T.id, provider: "sepay", providerTxId: `ui-${i}`, occurredAt: new Date(Date.now() - 6.5 * DAY), amount: 100000, content: "x", kind: "no_code", status: "pending" } });
  await p.reload({ waitUntil: "networkidle" });
  await p.locator('[data-testid="so-zaloOpened"]').waitFor({ timeout: 60000 });
  check("chỉ số 1: 83% và '10 / 12 phiếu đã gửi'", (await p.locator('[data-testid="so-zaloOpened"]').innerText()) === "83%" && await p.getByText("10 / 12 phiếu đã gửi").isVisible());
  check("chỉ số 2: mẫu số 8 phiếu có link riêng (<10) → vẫn 'Chưa đủ dữ liệu', không hiện 50%", (await p.locator('[data-testid="so-parentViewed"]').innerText()) === "—" && await p.getByText(/8 phiếu đã mở Zalo có link riêng · cần từ 10 mới hiện phần trăm/).isVisible());
  check("khoản tiền: 3 chờ gia sư, chờ lâu nhất 6 ngày", /Chờ gia sư 3/.test(await p.getByTestId("tien-chi-tiet").innerText()) && /6 ngày/.test(await p.getByTestId("tien-cho-lau").innerText()));
  check("không lộ tên học sinh hay gia sư trên trang", (await p.getByText(/Học sinh \d|Cô Lan/).count()) === 0);
  await shot(p, "so-do-admin");

  section("Chọn khoảng thời gian");
  const req = p.waitForRequest(r => /\/api\/admin\/health-metrics\?days=7/.test(r.url()));
  await p.getByLabel("Khoảng thời gian").selectOption("7");
  await req;
  check("chọn 7 ngày → gọi API days=7 và dòng khoảng ngày đổi", /Khoảng/.test(await p.getByTestId("khoang").innerText()));

  section("Lỗi mạng: thông báo + Thử lại");
  await p.route("**/api/admin/health-metrics*", r => r.fulfill({ status: 500, body: "{}" }));
  await p.getByLabel("Khoảng thời gian").selectOption("30");
  await p.getByRole("alert").getByText("Không tải được số đo.").waitFor({ timeout: 15000 });
  await p.unroute("**/api/admin/health-metrics*");
  await p.getByRole("button", { name: "Thử lại" }).click();
  await p.locator("[data-metric]").first().waitFor({ timeout: 30000 });
  check("bấm Thử lại → các thẻ trở lại", (await p.locator("[data-metric]").count()) === 6);

  section("Menu quản trị");
  const mp = await ctx.newPage(); watch(mp);
  await mp.goto(`${ADMIN}/admin`, { waitUntil: "networkidle", timeout: 120000 });
  const link = mp.getByRole("link", { name: "Số đo sản phẩm" }).first();
  await link.waitFor({ timeout: 60000 });
  await link.click();
  await mp.getByRole("heading", { name: "Số đo sức khoẻ sản phẩm", level: 1 }).waitFor({ timeout: 60000 });
  check("'Số đo sản phẩm' có trong module Báo cáo và dẫn tới trang", /\/admin\/so-do$/.test(mp.url()));

  section("Gia sư không vào được");
  const tctx = await ctxFor(T);
  const tp = await tctx.newPage(); watch(tp);
  // Mở bằng tên miền CHÍNH (BASE): gia sư ở lại đó. Mở bằng tên miền admin thì bị chuyển sang midnightelite-edu.com, nơi ctxFor() không đặt cookie phiên (cookie không dùng chung giữa hai tên miền) → thành khách → chuyển ngược lại → vòng lặp chuyển hướng của bộ test, không phải lỗi sản phẩm.
  await tp.goto(`${BASE}/admin/so-do`, { waitUntil: "networkidle", timeout: 120000 });
  await new Promise(r => setTimeout(r, 1500));
  check("gia sư không thấy sáu thẻ số đo", (await tp.locator("[data-metric]").count()) === 0 && (await tp.getByText(/^Mẫu số:/).count()) === 0);

  section("Điện thoại 390px");
  const mctx = await ctxFor(SA, { width: 390, height: 800 });
  const m = await mctx.newPage(); watch(m);
  await m.goto(`${ADMIN}/admin/so-do`, { waitUntil: "networkidle", timeout: 120000 });
  await m.locator("[data-metric]").first().waitFor({ timeout: 60000 });
  check("không tràn ngang, các thẻ xếp một cột", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) && (await m.locator("[data-metric]").evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().left))).size)) === 1);

  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
