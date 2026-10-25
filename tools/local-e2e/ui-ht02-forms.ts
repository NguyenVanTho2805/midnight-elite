// HT-02 (24/10/2026) — kiểm dữ liệu tại chỗ ở 4 nơi: form đăng ký (KinInput), wizard tạo lớp, thêm học sinh, hồ sơ gia sư.
// Mỗi nơi: viền đỏ + dòng báo dưới ô, aria-invalid, tiêu điểm nhảy tới ô lỗi ĐẦU TIÊN, câu báo KHÔNG chứa nội dung đã nhập. Chạy 1440 và 390 (không tràn ngang).
import { BASE, mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]\d\d|negative time stamp/i.test(m.text())) errors.push(m.text()); });
  };
  let ip = Math.floor(Math.random() * 200);
  const noOverflow = (p: Page) => p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`) as Promise<boolean>;
  const active = (p: Page) => p.evaluate(`document.activeElement ? (document.activeElement.id || document.activeElement.getAttribute("placeholder") || document.activeElement.tagName) : ""`) as Promise<string>;
  const invalidCount = (p: Page) => p.locator('[aria-invalid="true"]').count();

  for (const [w, h, tag] of [[1440, 900, "1440"], [390, 844, "390"]] as const) {
    section(`[${tag}] Đăng ký gia sư: báo tại ô, nhảy tới ô lỗi đầu tiên`);
    const gc = await ctxFor(null, { width: w, height: h });
    await gc.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await gc.setExtraHTTPHeaders({ "x-forwarded-for": `10.97.${Math.floor(Math.random() * 250)}.${++ip % 250}` });
    const g = await gc.newPage(); watch(g);
    await g.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
    await g.getByRole("button", { name: /^Gia sư/ }).click();
    await g.getByLabel("Họ và tên *").waitFor({ timeout: 60000 });
    await g.getByRole("button", { name: /Tiếp theo/ }).click();
    check("để trống rồi bấm → 4 chỗ báo lỗi: họ tên, số điện thoại, giới thiệu, môn dạy (aria-invalid)", await invalidCount(g) === 4, await invalidCount(g));
    check("tiêu điểm nhảy tới ô đầu tiên (Họ và tên)", await g.getByLabel("Họ và tên *").evaluate(el => el === document.activeElement));
    check("dòng báo nằm dưới ô và nối aria-describedby", await g.getByLabel("Họ và tên *").evaluate(el => { const id = el.getAttribute("aria-describedby"); const p = id ? document.getElementById(id) : null; return !!p && /họ và tên/.test(p.textContent ?? ""); }));
    check("viền ô lỗi dày 2px (không chỉ đổi màu)", await g.getByLabel("Họ và tên *").evaluate(el => (el.closest("[data-kin-input-wrap]") as HTMLElement).style.border.startsWith("2px")));
    await g.getByLabel("Họ và tên *").fill("Cô Thử");
    await g.getByLabel(/Số điện thoại \(Zalo\)/).fill("0999SDT");
    await g.getByLabel(/Số điện thoại \(Zalo\)/).blur();
    const phoneMsg = await g.locator("[data-kin-input-error]").filter({ hasText: "Số điện thoại" }).innerText();
    check("SĐT sai → báo 'không hợp lệ', câu báo KHÔNG chứa chữ đã nhập", /không hợp lệ/.test(phoneMsg) && !/SDT|0999/.test(phoneMsg), phoneMsg);
    await g.getByLabel(/Số điện thoại \(Zalo\)/).fill("0912 345 678");
    check("sửa đúng → dòng báo của ô số điện thoại biến mất ngay", (await g.locator("[data-kin-input-error]").filter({ hasText: "Số điện thoại" }).count()) === 0);
    await g.locator("#dk-bio").fill("ngắn");
    await g.locator("#dk-bio").blur();
    check("giới thiệu quá ngắn → báo 'ít nhất 30 ký tự' ngay khi rời ô", await g.getByText("Giới thiệu cần ít nhất 30 ký tự").isVisible());
    await g.locator("#dk-bio").fill("Cử nhân Toán, 3 năm dạy ôn ĐGNL cho học sinh lớp 12, hay dùng đề thật để luyện.");
    await g.getByRole("button", { name: "Toán", exact: true }).click();
    await g.getByRole("button", { name: /Tiếp theo/ }).click();
    await g.getByPlaceholder("ten@gmail.com").waitFor({ timeout: 30000 });
    await g.getByPlaceholder("ten@gmail.com").fill("khong-phai-email");
    await g.getByPlaceholder("Tối thiểu 8 ký tự").fill("1234");
    await g.getByPlaceholder("Nhập lại mật khẩu").fill("khac-nhau");
    for (let i = 0; i < 5 && !(await g.locator('form input[type="checkbox"]').isChecked()); i++) { await g.locator('form input[type="checkbox"]').click(); await g.waitForTimeout(300); } // máy bận: lần bấm đầu có thể rơi vào lúc trang còn dựng lại
    await g.getByRole("button", { name: /Tạo tài khoản/ }).click();
    check("bước 2: email sai, mật khẩu 4 ký tự, xác nhận không khớp → 3 ô báo lỗi", await invalidCount(g) === 3, await invalidCount(g));
    check("tiêu điểm nhảy tới ô Email (lỗi đầu tiên)", await g.getByPlaceholder("ten@gmail.com").evaluate(el => el === document.activeElement));
    const msgs = (await g.locator("[data-kin-input-error]").allInnerTexts()).join(" | ");
    check("câu báo đúng nội dung và KHÔNG chứa mật khẩu/email đã nhập", /Email không đúng định dạng/.test(msgs) && /ít nhất 8 ký tự/.test(msgs) && /không khớp/.test(msgs) && !/khong-phai|khac-nhau|1234/.test(msgs), msgs);
    check("nút ẩn/hiện mật khẩu có tên và cao ≥ 44px", await (async () => { const b = g.getByRole("button", { name: "Hiện mật khẩu" }).first(); const bb = await b.boundingBox(); return !!bb && bb.height >= 43.5; })());
    check("không tràn ngang", await noOverflow(g));
    if (tag === "390") await shot(g, "ht02-dang-ky-390");
    await gc.close();

    const tc = await ctxFor(T, { width: w, height: h });
    const p = await tc.newPage(); watch(p);

    section(`[${tag}] Wizard tạo lớp: tên trống, rồi theo giờ thiếu đơn giá`);
    await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
    await p.getByRole("button", { name: "Tiếp tục" }).click();
    check("tên trống → ô Tên lớp aria-invalid, có dòng báo ngay dưới ô, tiêu điểm vào ô", await p.getByLabel(/Tên lớp/).getAttribute("aria-invalid") === "true" && (await p.locator("[data-kin-input-error]").filter({ hasText: "tên lớp" }).count()) === 1 && await p.getByLabel(/Tên lớp/).evaluate(el => el === document.activeElement));
    await p.getByLabel(/Tên lớp/).fill("Toán 9 HT02");
    await p.getByLabel(/Theo giờ/).check();
    await p.getByRole("button", { name: "Tiếp tục" }).click();
    check("theo giờ + chưa nhập đơn giá → ô Đơn giá báo lỗi và nhận tiêu điểm (ô tên đã đúng nên không báo)", await p.getByLabel(/^Đơn giá/).getAttribute("aria-invalid") === "true" && await p.getByLabel(/^Đơn giá/).evaluate(el => el === document.activeElement) && await p.getByLabel(/Tên lớp/).getAttribute("aria-invalid") === null);
    await p.getByLabel(/^Đơn giá/).fill("150000");
    check("nhập đơn giá hợp lệ → dòng báo biến mất ngay (theo từng phím)", await p.getByLabel(/^Đơn giá/).getAttribute("aria-invalid") === null);
    check("không tràn ngang", await noOverflow(p));

    section(`[${tag}] Thêm học sinh: số điện thoại phụ huynh sai chặn bước, sửa xong đi tiếp`);
    await p.goto(`${BASE}/lop-cua-toi/hoc-sinh/them`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByText("Con (dưới 16 tuổi)").click();
    await p.getByText("Dưới 7 tuổi").click();
    await p.getByRole("button", { name: "Tiếp tục" }).click();
    await p.getByLabel(/^Tên em/).waitFor({ timeout: 30000 });
    await p.getByRole("button", { name: "Tiếp tục" }).click();
    check("tên em trống → báo 'Nhập tên em', aria-invalid, tiêu điểm vào ô", await p.getByLabel(/^Tên em/).getAttribute("aria-invalid") === "true" && await p.getByText("Nhập tên em", { exact: true }).isVisible() && await p.getByLabel(/^Tên em/).evaluate(el => el === document.activeElement));
    await p.getByLabel(/^Tên em/).fill("Em Thử");
    await p.getByLabel(/Số Zalo \/ điện thoại phụ huynh/).fill("98765");
    await p.getByLabel(/Số Zalo \/ điện thoại phụ huynh/).blur();
    const gm = await p.getByText(/phải đủ 10 chữ số/).innerText();
    check("SĐT phụ huynh 5 số → báo 'phải đủ 10 chữ số' tại ô, KHÔNG lặp lại số đã nhập", !gm.includes("98765"), gm);
    await p.getByRole("button", { name: "Tiếp tục" }).click();
    check("bấm Tiếp tục vẫn ở bước 2 (không lưu, không sang bước 3)", await p.getByText(/Bước 2 trên 4/).isVisible() && await p.getByLabel(/Số Zalo \/ điện thoại phụ huynh/).evaluate(el => el === document.activeElement));
    await p.getByLabel(/Số Zalo \/ điện thoại phụ huynh/).fill("0901 234 567");
    await p.getByRole("button", { name: "Tiếp tục" }).click();
    check("sửa đúng (có dấu cách) → sang bước 3", await p.getByText(/Bước 3 trên 4/).isVisible());
    await p.getByLabel("Email", { exact: true }).fill("sai-dang");
    await p.getByLabel("Email", { exact: true }).blur();
    check("email sai ở bước 3 → báo ngay tại ô", await p.getByText(/Email chưa đúng dạng/).isVisible());
    check("không tràn ngang", await noOverflow(p));
    check("chưa có hồ sơ nào bị lưu trong cả quá trình (kiểm DB)", (await prisma.studentProfile.count()) === 0);

    section(`[${tag}] Hồ sơ gia sư: bỏ hết môn → báo tại ô môn, nhảy tới ô`);
    await p.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
    await p.getByRole("heading", { name: "Hồ sơ gia sư" }).waitFor({ timeout: 60000 });
    await p.getByRole("button", { name: "Lưu hồ sơ" }).click();
    check("chưa có môn → ô 'Thêm môn dạy' aria-invalid, dòng báo ngay dưới, tiêu điểm vào ô", await p.getByLabel("Thêm môn dạy").getAttribute("aria-invalid") === "true" && await p.getByText("Chọn ít nhất 1 môn dạy").isVisible() && await p.getByLabel("Thêm môn dạy").evaluate(el => el === document.activeElement));
    await p.getByLabel("Thêm môn dạy").fill("Toán"); await p.getByLabel("Thêm môn dạy").press("Enter");
    check("thêm môn → báo lỗi biến mất", await p.getByLabel("Thêm môn dạy").getAttribute("aria-invalid") === null);
    await p.getByRole("switch", { name: "Hiện giá tham khảo mỗi buổi" }).click();
    await p.getByRole("button", { name: "Lưu hồ sơ" }).click();
    check("bật hiện giá mà chưa nhập → ô giá báo lỗi và nhận tiêu điểm", await p.locator("#khuvuc-price").getAttribute("aria-invalid") === "true" && await p.locator("#khuvuc-price").evaluate(el => el === document.activeElement) && await p.getByText(/Bật hiện giá thì hãy nhập giá/).isVisible());
    check("không tràn ngang", await noOverflow(p));
    if (tag === "390") await shot(p, "ht02-ho-so-390");
    await tc.close();
  }
  check("không có lỗi console / pageerror", errors.length === 0, errors.slice(0, 4));
  await closeAll(); done();
})();
