// KiN Pro — màn "Gói của tôi" (gia sư) và trang cấu hình gói (admin) trên trình duyệt. Cần Postgres + Next dev + Playwright.
// Chạy hai lần, mỗi lần máy chủ khác nhau (xem tools/local-e2e/pro-plan-run.sh để khởi động máy chủ C):
//   EXPECT_PAY=0 EXPECT_ENFORCE=0   máy chủ mặc định → 'Chưa mở bán', không số tài khoản
//   EXPECT_PAY=1 EXPECT_ENFORCE=1   máy chủ C (KIN_PLAN_ENFORCE=1 + KINPRO_*) → giá, QR, kích hoạt qua giao diện admin
import { BASE, api, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

const flag = (n: string) => { const v = process.env[n]; if (v !== "0" && v !== "1") throw new Error(`Đặt ${n}=0 hoặc 1`); return v === "1"; };
const PAY = flag("EXPECT_PAY"), ENFORCE = flag("EXPECT_ENFORCE");

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), SA = await mkSuper("Quản trị");
  const course = await mkCourse(T.id, { name: "Toán 9" });
  const add = async (n: number) => { for (let i = 0; i < n; i++) { const s = await mkUser({ name: `Em ${Math.random().toString(36).slice(2, 6)}` }); await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active" } }); } };
  await add(8);

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    const devPerf = /negative time stamp/i;
    p.on("pageerror", (e: unknown) => { if (!devPerf.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 4|status of 5|Hydration/i.test(m.text()) && !devPerf.test(m.text())) errors.push(m.text()); });
  };
  const ctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg);

  section("Vào 'Gói của tôi' từ bảng Khác");
  await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("navigation", { name: "Module của gia sư" }).getByRole("button", { name: /^Khác/ }).click();
  const dlg = pg.getByRole("dialog", { name: "Các mục khác" });
  check("bảng Khác có mục 'Gói của tôi' → /lop-cua-toi/goi", await dlg.getByRole("link", { name: "Gói của tôi", exact: true }).getAttribute("href") === "/lop-cua-toi/goi");
  await dlg.getByRole("link", { name: "Gói của tôi", exact: true }).click();
  await pg.getByRole("heading", { name: "Gói của tôi", level: 1 }).waitFor({ timeout: 90000 });
  await pg.getByTestId("goi-hien-tai").waitFor({ timeout: 60000 });

  section("Gói hiện tại, thanh x/N, quota AI");
  check("gói hiện tại: Free, 'Không bao giờ hết hạn'", (await pg.getByTestId("goi-hien-tai").innerText()) === "Free" && await pg.getByText("Không bao giờ hết hạn").isVisible());
  check("học viên 8/10; lượt AI còn 3", (await pg.getByTestId("hoc-vien").innerText()) === "8/10" && (await pg.getByTestId("luot-ai").innerText()) === "còn 3");
  const bar = pg.getByTestId("thanh-hoc-vien");
  check("8/10 = warn: thanh có role progressbar và CHỮ 'Gần đến hạn mức' (màu không nói một mình)", await bar.getAttribute("data-state") === "warn" && await bar.getByRole("progressbar").getAttribute("aria-valuenow") === "8" && await bar.getByText("Gần đến hạn mức").isVisible());
  check(ENFORCE ? "cổng BẬT: không hiện dòng 'chưa áp hạn mức'" : "cổng TẮT: nói thẳng 'Hiện KiN chưa áp hạn mức' (không ai bị chặn)", (await pg.getByText("Hiện KiN chưa áp hạn mức").count()) === (ENFORCE ? 0 : 1));
  check("nói rõ hạn mức chỉ chặn việc thêm mới; Sổ của con, xuất dữ liệu luôn mở", await pg.getByText(/chỉ chặn việc.*thêm mới/).isVisible() && await pg.getByText(/Sổ của con và xuất dữ liệu|xuất dữ liệu và Sổ của con/).isVisible());
  await add(2);
  await pg.reload({ waitUntil: "networkidle" }); await pg.getByTestId("goi-hien-tai").waitFor();
  check("10/10 = blocked: 'Đã đạt hạn mức: chưa nhận thêm được'", await pg.getByTestId("thanh-hoc-vien").getAttribute("data-state") === "blocked" && await pg.getByText("Đã đạt hạn mức: chưa nhận thêm được").first().isVisible());
  await add(2);
  await pg.reload({ waitUntil: "networkidle" }); await pg.getByTestId("goi-hien-tai").waitFor();
  check("12/10 = over: chữ 'mọi thứ giữ nguyên, chỉ chưa nhận thêm'; lớp vẫn đủ 12 em", await pg.getByTestId("thanh-hoc-vien").getAttribute("data-state") === "over" && await pg.getByText(/mọi thứ giữ nguyên, chỉ chưa nhận thêm/).isVisible() && (await pg.getByTestId("hoc-vien").innerText()) === "12/10");

  section("So sánh Free và Pro (bảng 8.4)");
  const tbl = pg.getByTestId("so-sanh");
  check("có đủ hàng: học viên, nhắc học phí, báo cáo, xuất dữ liệu, thống kê, thông báo đẩy, AI, hỗ trợ", await Promise.all(["Học viên đang học", "Nhắc học phí", "Báo cáo tháng và phiếu", "Xuất dữ liệu", "Thống kê", "Thông báo đẩy", "AI trích đề", "Hỗ trợ", "Sổ của con"].map(t => tbl.getByText(t).first().isVisible())).then(r => r.every(Boolean)));
  check("con số lấy từ cấu hình: Free 'Tối đa 10', AI '3 lượt' / '20 lượt mỗi tháng'", await tbl.getByText("Tối đa 10").isVisible() && await tbl.getByText("3 lượt mỗi tháng").isVisible() && await tbl.getByText("20 lượt mỗi tháng").isVisible());
  check("tính năng chưa dựng ghi rõ 'đang dựng' (KiN không bán cái chưa có)", (await tbl.getByText("đang dựng").count()) >= 3 && await pg.getByText(/không bán cái chưa có/).isVisible());
  check("lõi và Sổ của con ghi 'Luôn mở'", await tbl.getByText("Luôn mở").first().isVisible());
  check("có câu 'Khi hết hạn Pro' nói giữ nguyên dữ liệu và chữ trung tính cho học viên", await pg.getByText(/giữ nguyên 100%, không ẩn, không xoá/).isVisible() && await pg.getByText(/“Lớp tạm chưa nhận thêm”/).isVisible());

  section(PAY ? "Mua theo kỳ: giá từ cấu hình, QR VietQR, nội dung KINPRO-" : "Chưa cấu hình nhận tiền → 'Chưa mở bán'");
  if (!PAY) {
    check("hiện 'Chưa mở bán', không có nút chọn kỳ, không có QR", await pg.getByTestId("chua-mo-ban").isVisible() && (await pg.getByTestId("ky-month").count()) === 0 && (await pg.getByTestId("khung-qr").count()) === 0);
    const body = await pg.locator("body").innerText();
    check("trang không có số tài khoản nào (không 0123456789, không CONG TY KIN EDUCATION, không dãy ≥9 chữ số)", !/0123456789|CONG TY KIN EDUCATION|\d{9,}/.test(body), body.match(/\d{9,}/));
  } else {
    for (const [k, price] of [["month", "55.300đ"], ["quarter", "139.300đ"], ["year", "419.300đ"]] as const) check(`kỳ ${k}: ${price} (giá sáng lập −30% của giá cấu hình)`, (await pg.getByTestId(`ky-${k}`).innerText()).includes(price));
    check("quy ra mỗi tháng và ghi giá thường", /Quy ra .* mỗi tháng/.test(await pg.getByTestId("ky-year").innerText()) && /giá thường 79\.000đ/.test(await pg.getByTestId("ky-month").innerText()));
    check("nói không tự động trừ tiền, không Coin", await pg.getByText(/không tự động trừ tiền, không dùng Coin/).isVisible());
    await pg.getByTestId("ky-month").getByRole("button", { name: "Chọn kỳ này" }).click();
    await pg.getByTestId("khung-qr").waitFor({ timeout: 30000 });
    const memo = await pg.getByTestId("qr-noi-dung").innerText();
    check("QR hiện ra: số tiền 55.300đ, nội dung KINPRO-xxxxxxxx, số TK từ biến môi trường", (await pg.getByTestId("qr-so-tien").innerText()) === "55.300đ" && /^KINPRO-[2-9A-Z]{8}$/.test(memo) && (await pg.getByTestId("qr-so-tk").innerText()) === "9704360012345");
    const img = pg.getByTestId("khung-qr").getByRole("img");
    check("ảnh QR có chữ thay thế mô tả số tiền và nội dung, trỏ tới VietQR", (await img.getAttribute("alt"))!.includes(memo) && (await img.getAttribute("src"))!.startsWith("https://img.vietqr.io/image/970436-9704360012345"));
    check("có nút chép số tài khoản + nội dung; nói rõ đối chiếu BẰNG TAY", (await pg.getByRole("button", { name: "Chép số tài khoản" }).count()) === 1 && (await pg.getByRole("button", { name: "Chép nội dung chuyển khoản" }).count()) === 1 && await pg.getByText(/làm bằng tay nên chưa tự động/).isVisible());
    await shot(pg, "pro-goi-qr");

    section("Admin: thấy yêu cầu, kích hoạt, cộng hạn");
    const actx = await ctxFor(SA, { width: 1280, height: 900 });
    const ap = await actx.newPage(); watch(ap);
    await ap.goto(`${ADMIN}/admin/goi-pro`, { waitUntil: "networkidle", timeout: 120000 });
    await ap.getByRole("heading", { name: "Gói KiN Pro", level: 1 }).waitFor({ timeout: 90000 });
    await ap.getByTestId("cong").waitFor({ timeout: 60000 });
    check("trang admin hiện cổng BẬT, bán gói 'Đang mở', số đo theo trần Free", (await ap.getByTestId("cong").innerText()) === "Đang BẬT" && (await ap.getByTestId("ban").innerText()) === "Đang mở" && (await ap.getByTestId("do-over").innerText()) === "1");
    const railLink = ap.getByRole("navigation", { name: "Module quản trị" }).getByRole("link", { name: /^Cài đặt/ });
    check("menu admin: module 'Cài đặt' dẫn tới /admin/goi-pro và sáng khi đang ở trang này", await railLink.getAttribute("href") === "/admin/goi-pro" && await railLink.getAttribute("aria-current") === "page");
    const row = ap.locator(`[data-order]`).first();
    check("hàng yêu cầu: tên gia sư, mã, giá sáng lập, trạng thái chữ 'Đang chờ đối chiếu'", (await row.innerText()).includes("Cô Lan") && (await row.innerText()).includes(memo) && (await row.innerText()).includes("giá sáng lập −30%") && (await row.innerText()).includes("Đang chờ đối chiếu"));
    await ap.getByTestId(`kich-hoat-${memo}`).click();
    const cf = ap.getByRole("dialog");
    check("hộp xác nhận (KinConfirm, không window.confirm) nhắc đối chiếu sao kê trước", await cf.isVisible() && /đã thấy tiền về/.test(await cf.innerText()));
    await cf.getByRole("button", { name: "Kích hoạt", exact: true }).click();
    await ap.getByText("Đã kích hoạt và cộng dồn hạn.").waitFor({ timeout: 30000 });
    check("hàng chuyển sang 'Đã kích hoạt', mất nút", (await ap.locator("[data-order]").first().getAttribute("data-status")) === "active" && (await ap.getByTestId(`kich-hoat-${memo}`).count()) === 0);
    await pg.reload({ waitUntil: "networkidle" }); await pg.getByTestId("goi-hien-tai").waitFor();
    check("gia sư tải lại: 'KiN Pro', 'Còn hiệu lực tới …', trần học viên là của Pro", (await pg.getByTestId("goi-hien-tai").innerText()) === "KiN Pro" && await pg.getByText(/Còn hiệu lực tới \d{2}\/\d{2}\/\d{4}/).isVisible() && (await pg.getByTestId("hoc-vien").innerText()) === "12/500");
    check("lịch sử ghi 'Pro 1 tháng · Đã mở Pro'", /Pro 1 tháng/.test(await pg.getByTestId("lich-su").innerText()) && /Đã mở Pro/.test(await pg.getByTestId("lich-su").innerText()));

    section("Admin: lưu cấu hình");
    await ap.getByTestId("pro-gia-thang").fill("89000");
    await ap.getByTestId("free-hoc-vien").fill("15");
    await ap.getByTestId("luu-cau-hinh").click();
    await ap.getByText(/Đã lưu cấu hình/).waitFor({ timeout: 30000 });
    await ap.reload({ waitUntil: "networkidle" }); await ap.getByTestId("pro-gia-thang").waitFor();
    check("cấu hình giữ sau khi tải lại: giá tháng 89.000, trần Free 15", (await ap.getByTestId("pro-gia-thang").inputValue()) === "89000" && (await ap.getByTestId("free-hoc-vien").inputValue()) === "15");
    await shot(ap, "pro-admin");
    const bad = await api("PUT", "/api/admin/pro/config", { as: SA, body: { plans: [{ code: "free", name: "Free", studentLimit: 10, aiExtractPerMonth: 3, priceMonthVnd: 0, priceQuarterVnd: 0, priceYearVnd: 0 }, { code: "pro", name: "KiN Pro", studentLimit: 500, aiExtractPerMonth: 20, priceMonthVnd: 79000, priceQuarterVnd: 199000, priceYearVnd: 599000 }] } });
    check("(trả cấu hình về mặc định)", bad.status === 200);
    await actx.close();
  }

  section("Trạng thái lỗi + Thử lại");
  await pg.route("**/api/tutor/goi", r => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }));
  await pg.reload({ waitUntil: "networkidle" });
  await pg.getByText("Chưa tải được thông tin gói").waitFor({ timeout: 60000 });
  check("lỗi tải: thẻ lỗi có chữ, role alert, nút Thử lại, nói dữ liệu không mất", await pg.locator("[data-kin-state=loi]").isVisible() && await pg.getByRole("button", { name: "Thử lại" }).isVisible() && await pg.getByText(/không bị ảnh hưởng/).isVisible());
  await pg.unroute("**/api/tutor/goi");
  await pg.getByRole("button", { name: "Thử lại" }).click();
  await pg.getByTestId("goi-hien-tai").waitFor({ timeout: 60000 });
  check("Thử lại → tải được", await pg.getByTestId("goi-hien-tai").isVisible());

  section("Điện thoại 390px");
  const m = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(m);
  await m.goto(`${BASE}/lop-cua-toi/goi`, { waitUntil: "networkidle", timeout: 120000 });
  await m.getByTestId("goi-hien-tai").waitFor({ timeout: 60000 });
  // Chỉ xét nội dung trang (bỏ lớp phủ công cụ dev của Next, nằm ngoài [data-kin-page]).
  const over = await m.evaluate(`[...document.querySelectorAll('[data-kin-page] *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > 391).map(e => e.tagName + ' ' + (e.textContent || '').slice(0, 30))`);
  check("không phần tử nào của trang tràn ngang ở 390px", (over as string[]).length === 0, over);
  const tiny = await m.evaluate(`[...document.querySelectorAll('main button, [data-kin-page] button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height).filter(h => h < 43.5)`);
  check("mọi nút ≥ 44px", (tiny as number[]).length === 0, tiny);
  await shot(m, "pro-goi-390");

  section("Chặn quyền");
  const sctx = await ctxFor(await mkUser({ name: "Học sinh" }));
  const sp = await sctx.newPage();
  await sp.goto(`${BASE}/lop-cua-toi/goi`, { waitUntil: "networkidle", timeout: 120000 });
  check("học sinh vào /lop-cua-toi/goi bị chuyển đi nơi khác", !new URL(sp.url()).pathname.startsWith("/lop-cua-toi/goi"), sp.url());

  check("không lỗi console / pageerror", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
