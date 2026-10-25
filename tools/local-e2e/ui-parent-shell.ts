// Khung riêng của trang phụ huynh (/phieu, /so-cua-con): không có menu bán khoá học, nút "Bắt đầu miễn phí", chân trang quảng bá, thanh dưới của học viên.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";

const tok = (b: number) => b.toString(16).padStart(2, "0").repeat(16);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Minh Anh" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: course.id, status: "active" } });
  await prisma.tutorPayoutAccount.create({ data: { userId: T.id, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN LAN" } });
  const invTok = tok(0xc3), expTok = tok(0xd4), portalTok = tok(0xa1);
  const mkInv = (viewToken: string, ym: string, expires: Date) => prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId: T.id, studentId: A.id, yearMonth: ym, amountDue: 1_200_000, status: "sent", sentAt: new Date(), viewToken, viewTokenExpiresAt: expires } });
  await mkInv(invTok, "2026-10", new Date(Date.now() + 20 * 86400_000));
  await mkInv(expTok, "2026-09", new Date(Date.now() - 1000));
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "Chị Hoa" })).id, studentId: A.id, status: "verified", verifiedAt: new Date(), portalToken: portalTok } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|qr|vietqr/i.test(m.text())) errors.push(m.text()); }); };

  const chrome = async (p: any) => ({
    nav: await p.getByRole("navigation").count(),
    freeBtn: await p.getByRole("link", { name: /^(Đăng ký|Bắt đầu miễn phí)$/ }).count(),
    login: await p.getByRole("link", { name: /Đăng nhập/ }).count(),
    menu: await p.getByRole("link", { name: /^(Lớp học|Khóa học|Khoá học|Gia sư|Thi thử|Thi thử ĐGNL|Cộng đồng|Bảng xếp hạng|Tin tức)$/ }).count(),
    footerPromo: await p.getByText(/Công cụ học tập|Hỗ trợ học viên|Hotline/).count(),
  });
  const clean = (c: Record<string, number>) => Object.values(c).every(n => n === 0);

  section("Phiếu học phí (khách, không đăng nhập)");
  const gctx = await ctxFor(null);
  const pg = await gctx.newPage(); watch(pg);
  await pg.goto(`${BASE}/phieu/${invTok}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("heading", { name: /Phiếu học phí của con: Minh Anh/ }).waitFor({ timeout: 90000 });
  const c1 = await chrome(pg);
  check("KHÔNG có thanh menu, nút 'Bắt đầu miễn phí', link Đăng nhập, chân trang quảng bá", clean(c1), c1);
  check("có thanh trên tối giản: logo KiN + 'Trang riêng cho phụ huynh' (vùng banner)", await pg.getByRole("banner").getByText("Trang riêng cho phụ huynh").isVisible() && (await pg.getByRole("banner").innerText()).replace(/\s+/g, "").includes("KiN"));
  check("logo KiN KHÔNG phải liên kết (không dẫn phụ huynh ra trang bán khoá)", (await pg.getByRole("banner").getByRole("link").count()) === 0);
  check("chân trang nhắc: đường dẫn riêng, đừng chuyển tiếp", await pg.getByRole("contentinfo").getByText(/Đừng chuyển tiếp cho người khác/).isVisible());
  check("nội dung phiếu vẫn đủ: số tiền 1.200.000đ, nút 'Tôi đã chuyển'", await pg.getByText(/1\.200\.000/).first().isVisible() && await pg.getByRole("button", { name: /Tôi đã chuyển/ }).isVisible());
  check("thẻ xem trước vẫn noindex + tiêu đề chung", /<meta name="robots" content="noindex/.test(await pg.content()) && (await pg.title()).includes("Phiếu học phí — KiN"));
  await shot(pg, "parent-shell-phieu");

  section("Phiếu hết hạn: vẫn trong khung riêng, chân trang nằm cuối màn hình");
  await pg.goto(`${BASE}/phieu/${expTok}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("status").waitFor({ timeout: 60000 });
  const c2 = await chrome(pg);
  check("trang thông báo hết hạn cũng KHÔNG có menu / nút miễn phí", clean(c2), c2);
  check("chân trang dính đáy màn hình khi nội dung ngắn (không lơ lửng giữa trang)", await pg.evaluate(`(() => { const r = document.querySelector("footer").getBoundingClientRect(); return Math.abs(r.bottom - window.innerHeight) <= 1; })()`) as boolean);
  check("không có thanh cuộn thừa (khung không cộng thêm 100vh)", await pg.evaluate(`document.documentElement.scrollHeight <= window.innerHeight + 1`) as boolean);

  section("Link sai → 404 thật");
  const bad = await fetch(`${BASE}/phieu/${tok(0xee)}`, { redirect: "manual" });
  const badHtml = await bad.text();
  check("/phieu/<mã không có> trả HTTP 404 (không còn 200 như khi dùng khung guest)", bad.status === 404, bad.status);
  check("trang 404 không kèm 'Bắt đầu miễn phí'", !badHtml.includes("Bắt đầu miễn phí"));
  const bad2 = await fetch(`${BASE}/so-cua-con/${tok(0xef)}`, { redirect: "manual" });
  check("/so-cua-con/<mã không có> cũng 404 thật", bad2.status === 404, bad2.status);
  check("mã sai định dạng → 404", (await fetch(`${BASE}/phieu/abc`, { redirect: "manual" })).status === 404);

  section("Sổ của con");
  const sp = await gctx.newPage(); watch(sp);
  await sp.goto(`${BASE}/so-cua-con/${portalTok}`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.getByText("Minh Anh").first().waitFor({ timeout: 90000 });
  const c3 = await chrome(sp);
  check("Sổ của con: KHÔNG có menu / nút miễn phí / chân trang quảng bá", clean(c3), c3);
  check("có thanh trên + chân trang của khung phụ huynh", await sp.getByRole("banner").getByText("Trang riêng cho phụ huynh").isVisible() && await sp.getByRole("contentinfo").isVisible());
  const sumTxt = await sp.locator("body").innerText();
  check("ô học phí tóm tắt: có phiếu tháng cũ chưa đóng → nhãn 'Học phí còn phải đóng' + ghi 'gồm cả các tháng trước', không gọi là 'tháng này'", /Học phí còn phải đóng/.test(sumTxt) && /gồm cả các tháng trước/.test(sumTxt) && /2\.400\.000/.test(sumTxt));
  await shot(sp, "parent-shell-so-cua-con");

  section("Phụ huynh đang đăng nhập bằng tài khoản học viên: vẫn không có thanh dưới của học viên");
  const sctx = await ctxFor(A, { width: 390, height: 800 });
  const mp = await sctx.newPage(); watch(mp);
  await mp.goto(`${BASE}/phieu/${invTok}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: /Phiếu học phí của con/ }).waitFor({ timeout: 90000 });
  const c4 = await chrome(mp);
  check("đăng nhập học viên, điện thoại 390px: không thanh điều hướng dưới, không menu", clean(c4), c4);
  check("không tràn ngang trên điện thoại", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(mp, "parent-shell-mobile");

  section("Các trang guest khác KHÔNG bị ảnh hưởng");
  const gp = await gctx.newPage(); watch(gp);
  await gp.goto(`${BASE}/diem-chuan`, { waitUntil: "networkidle", timeout: 120000 });
  await gp.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
  check("/diem-chuan vẫn có thanh menu + nút Đăng ký + chân trang", await gp.getByRole("link", { name: "Đăng ký", exact: true }).first().isVisible() && await gp.getByText(/Công cụ học tập/).isVisible());

  const cg = await chrome(gp);
  check("bộ dò hoạt động thật: trang guest có navigation, nút miễn phí, link Đăng nhập, menu, chân trang quảng bá (không phải dò hụt)", cg.nav >= 1 && cg.freeBtn >= 1 && cg.login >= 1 && cg.menu >= 1 && cg.footerPromo >= 1, cg);

  check("không có lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
