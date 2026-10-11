import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "node:fs";

async function topupAndApprove(u: any, sup: any, amountVnd: number) {
  const c = await api("POST", "/api/wallet/topups", { as: u, body: { amountVnd, bankRef: "FT" + Math.random().toString(36).slice(2, 8) } });
  await api("POST", `/api/admin/topups/${c.json.request.id}/approve`, { as: sup });
}

(async () => {
  await wipe();
  const sup = await mkSuper("Super");
  const t1 = await mkTutor("Cô Lan");
  const t2 = await mkTutor("=HYPERLINK(\"http://evil\")"); // tên độc để thử CSV injection
  const s1 = await mkUser({ name: "HS 1" });
  const c1 = await mkCourse(t1.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: s1.id, courseId: c1.id, status: "active" } });
  await topupAndApprove(t1, sup, 3_000_000); await topupAndApprove(t2, sup, 500_000);
  await api("POST", "/api/subscriptions/monthly/purchase", { as: t1 });
  await api("POST", "/api/subscriptions/yearly/purchase", { as: t1 });
  await api("POST", "/api/subscriptions/monthly/purchase", { as: t2 });

  await launch();
  const ctx = await ctxFor(sup);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource/i.test(m.text())) errors.push(m.text()); });

  section("/admin/doanh-thu");
  await page.goto(`${ADMIN}/admin/doanh-thu`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Doanh thu", exact: true }).waitFor({ timeout: 60000 });
  await page.getByText("3.100.000đ").first().waitFor({ timeout: 30000 });
  check("thẻ doanh thu VIP ròng 3.100.000đ", true);
  check("thẻ gia sư đang VIP 2/2", await page.getByText("2/2").first().isVisible());
  check("thẻ Coin đã nạp 3.500.000đ", await page.getByText("3.500.000đ").first().isVisible());
  check("thẻ Coin trong ví 400.000đ", await page.getByText("400.000đ").first().isVisible());
  check("bảng theo gia sư có Cô Lan", await page.getByRole("table").getByText("Cô Lan").isVisible());
  const rows = await page.getByRole("table").locator("tbody tr").count();
  check("2 dòng gia sư", rows === 2, rows);
  await shot(page, "doanh-thu-desktop");

  section("Tìm gia sư + khoảng ngày");
  await page.getByLabel("Tìm gia sư").fill("lan");
  check("lọc 'lan' còn 1 dòng", (await page.getByRole("table").locator("tbody tr").count()) === 1);
  await page.getByLabel("Tìm gia sư").fill("zzz");
  await page.getByText(/Không có gia sư khớp/).waitFor();
  check("không khớp → thông báo", true);
  await page.getByLabel("Tìm gia sư").fill("");
  await page.getByRole("button", { name: "Tháng này" }).click();
  await page.getByText(/Đang xem: .* → /).waitFor();
  await page.getByText("3.100.000đ").first().waitFor({ timeout: 30000 }); // chờ tải lại xong rồi mới kiểm
  check("preset 'Tháng này' vẫn thấy doanh thu (giao dịch vừa tạo)", await page.getByText("3.100.000đ").first().isVisible());
  await page.getByLabel("Từ ngày").fill("2030-01-01");
  await page.getByLabel("Đến ngày").fill("2030-01-31");
  await page.getByText("Chưa có giao dịch trong khoảng này.").waitFor({ timeout: 30000 });
  check("khoảng tương lai → trạng thái rỗng", true);
  await page.getByRole("button", { name: "Tất cả" }).click();
  await page.getByText("3.100.000đ").first().waitFor();

  section("Xuất CSV (chống công thức)");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "↓ Xuất CSV" }).first().click()]);
  const path = await dl.path();
  const csv = readFileSync(path!, "utf8");
  check("CSV có BOM và tiêu đề", csv.startsWith("﻿Gia sư,Email,Số lớp"), csv.slice(0, 60));
  check("tên '=HYPERLINK' bị vô hiệu bằng nháy đơn", csv.includes(`"'=HYPERLINK(""http://evil"")"`) && !/^=HYPERLINK/m.test(csv), csv);
  check("có dòng Cô Lan với 2.800.000", /Cô Lan,[^,]+,1,1,2800000,2,/.test(csv), csv);

  section("Tổng quan /admin");
  await page.goto(`${ADMIN}/admin`, { waitUntil: "networkidle" });
  await page.getByText("Doanh thu VIP (ròng)").waitFor({ timeout: 60000 });
  check("thẻ Doanh thu VIP trên tổng quan", await page.getByText("3.1Mđ").first().isVisible());
  check("khối 'Mua VIP gần đây' có giao dịch", await page.getByText("VIP 1 năm").first().isVisible());
  check("khối 'Lớp đông học viên nhất' có Toán 9", await page.getByText("Toán 9").first().isVisible());
  await shot(page, "admin-tong-quan");

  section("Mobile 390px — vỏ admin dạng ngăn kéo");
  const mp = await (await ctxFor(sup, { width: 390, height: 800 })).newPage();
  await mp.goto(`${ADMIN}/admin/doanh-thu`, { waitUntil: "networkidle" });
  await mp.getByText("3.100.000đ").first().waitFor({ timeout: 60000 });
  const geo = await mp.evaluate(() => {
    const aside = document.getElementById("admin-sidebar")!.getBoundingClientRect();
    const val = [...document.querySelectorAll("div")].find(d => d.textContent === "3.100.000đ" && d.className.includes("font-extrabold"))!.getBoundingClientRect();
    return { asideRight: aside.right, valW: val.width, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  check("sidebar nằm ngoài màn hình khi đóng", geo.asideRight <= 1, geo);
  check("giá trị thẻ có chỗ hiển thị (>80px thay vì 0px)", geo.valW > 80, geo);
  check("không tràn ngang", !geo.overflowX, geo);
  await shot(mp, "doanh-thu-mobile");
  const burger = mp.getByRole("button", { name: "Mở menu" });
  check("có nút menu ☰, aria-expanded=false", (await burger.getAttribute("aria-expanded")) === "false");
  await burger.click();
  await mp.getByRole("link", { name: "Tổng quan" }).waitFor();
  await mp.waitForTimeout(300);
  const open = await mp.evaluate(() => document.getElementById("admin-sidebar")!.getBoundingClientRect().left);
  check("bấm ☰: sidebar trượt vào (left = 0)", Math.abs(open) < 2, open);
  check("aria-expanded=true khi mở", (await burger.getAttribute("aria-expanded")) === "true");
  await shot(mp, "admin-drawer-open");
  await mp.keyboard.press("Escape");
  await mp.waitForTimeout(300);
  check("Escape đóng ngăn kéo", (await mp.evaluate(() => document.getElementById("admin-sidebar")!.getBoundingClientRect().right)) <= 1);
  await burger.click();
  await mp.getByRole("link", { name: "Quản trị viên" }).click();
  await mp.waitForURL(/quan-tri-vien/);
  await mp.waitForTimeout(300);
  check("bấm một mục menu: điều hướng và tự đóng ngăn kéo", (await mp.evaluate(() => document.getElementById("admin-sidebar")!.getBoundingClientRect().right)) <= 1);
  await burger.click();
  await mp.mouse.click(380, 400); // bấm vào lớp phủ
  await mp.waitForTimeout(300);
  check("bấm lớp phủ cũng đóng", (await mp.evaluate(() => document.getElementById("admin-sidebar")!.getBoundingClientRect().right)) <= 1);

  section("Desktop 1280px vẫn như cũ");
  const dp = await (await ctxFor(sup)).newPage();
  await dp.goto(`${ADMIN}/admin/doanh-thu`, { waitUntil: "networkidle" });
  await dp.getByText("3.100.000đ").first().waitFor({ timeout: 60000 });
  check("sidebar hiện cố định, không có nút ☰", (await dp.evaluate(() => document.getElementById("admin-sidebar")!.getBoundingClientRect().left)) === 0 && !(await dp.getByRole("button", { name: "Mở menu" }).isVisible()));

  check("không có lỗi console/pageerror", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
