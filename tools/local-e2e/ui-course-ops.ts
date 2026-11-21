import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN, kinPick, kinValue } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan");
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  const s1 = await mkUser({ name: "Em Một" }), s2 = await mkUser({ name: "Em Hai" });
  await prisma.enrollment.create({ data: { userId: s1.id, courseId: course.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: s2.id, courseId: course.id, status: "pending_consent" } });
  await launch();

  const ctx = await ctxFor(tutor);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const dialogs: string[] = [];
  page.on("dialog", d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });

  // SCL-F2 (P2-25): Cài đặt lớp của gia sư chỉ còn tên lớp, môn · khối (KinSelect danh sách cố định), cách vào lớp, hiện/ẩn. Sức chứa / trạng thái nhận / giá / slug / nhãn
  // đã rời giao diện gia sư (dữ liệu giữ, quản trị sửa ở /admin/khoa-hoc/<id>) — kiểm form gọn thay cho phần "Vận hành lớp" cũ.
  section("Tab Cài đặt: Thông tin lớp (gọn)");
  await prisma.course.update({ where: { id: course.id }, data: { category: "toan · lop 9", price: 123000, tag: "HOT", capacity: 7 } });
  await page.goto(`${BASE}/admin/khoa-hoc/${course.id}?tab=cai-dat`, { waitUntil: "networkidle" });
  const form = page.locator("[data-cai-dat-thong-tin]");
  await form.waitFor({ timeout: 60000 });
  const ft = await form.innerText();
  check("không còn giá, slug, nhãn HOT, sức chứa, cảnh báo Cloudinary", !/Giá bán|Slug|HOT|Sức chứa|Cloudinary|Trạng thái nhận/.test(ft), ft.slice(0, 300));
  const mon = page.getByRole("combobox", { name: "Môn" }), khoi = page.getByRole("combobox", { name: "Khối" });
  check("dữ liệu cũ 'toan · lop 9' hiện chuẩn hoá: Toán / Lớp 9 (không sửa DB khi chưa lưu)", (await kinValue(mon)) === "Toán" && (await kinValue(khoi)) === "Lớp 9" && (await prisma.course.findUnique({ where: { id: course.id } }))?.category === "toan · lop 9", [await kinValue(mon), await kinValue(khoi)]);
  check("cách vào lớp + hiện/ẩn có chữ; gia sư không bật tắt hiện/ẩn trực tiếp", await form.locator("[data-cai-dat-policy]").isVisible() && await form.locator("[data-cai-dat-hien]").isVisible() && await form.getByRole("switch").count() === 0);
  await kinPick(mon, "Vật lý"); await kinPick(khoi, "Lớp 11");
  await page.getByLabel("Tên lớp").fill("Lý 11 thử");
  await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
  await eventually("DB: tên + 'Vật lý · Lớp 11'; giá, nhãn, sức chứa GIỮ NGUYÊN", async () => {
    const db = await prisma.course.findUnique({ where: { id: course.id } });
    return db?.name === "Lý 11 thử" && db?.category === "Vật lý · Lớp 11" && db?.price === 123000 && db?.tag === "HOT" && db?.capacity === 7;
  });
  check("báo 'Đã lưu thông tin lớp.'", await page.getByText("Đã lưu thông tin lớp.").isVisible());
  check("không hộp thoại gốc (alert)", dialogs.length === 0, dialogs);
  await shot(page, "course-ops-settings");
  const m = await (await ctxFor(tutor, { width: 390, height: 844 })).newPage();
  await m.goto(`${BASE}/lop-cua-toi/quan-lop/${course.id}?tab=cai-dat`, { waitUntil: "networkidle" });
  await m.locator("[data-cai-dat-thong-tin]").waitFor({ timeout: 60000 });
  const small = await m.evaluate(`[...document.querySelectorAll('[data-cai-dat-thong-tin] a, [data-cai-dat-thong-tin] button, [data-cai-dat-thong-tin] input')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.closest('label') && !(e.tagName === 'INPUT' && e.parentElement.getBoundingClientRect().height >= 43.5)).map(e => e.tagName + ':' + (e.getAttribute('type') || '') + ':' + e.className.slice(0,60) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
  check("390px: không tràn ngang, nút/ô ≥ 44px", (await m.evaluate("document.documentElement.scrollWidth")) as number <= 390 && small.length === 0, small);

  // LOI-07: bảng học viên nay là DanhBaLop (GS-LOP-GON) — KHÔNG còn cột "Trạng thái"; cột cuối "Hồ sơ" nói trạng thái bằng CHỮ: em đang học có liên kết "Hồ sơ",
  // em chờ phụ huynh đồng ý hiện "Chờ đồng ý" (DanhBaLop.tsx:126, :154-159). Kiểm theo bảng đang có thật, không thêm lại cột cũ.
  section("Tab Học viên (danh bạ lớp): cột Hồ sơ nói trạng thái bằng chữ");
  await page.goto(`${BASE}/admin/khoa-hoc/${course.id}?tab=hoc-vien`, { waitUntil: "networkidle" });
  await page.waitForURL(u => u.pathname === `/lop-cua-toi/quan-lop/${course.id}/hoc-vien`, { timeout: 60000 });
  await page.getByRole("table").getByText("Em Một", { exact: true }).waitFor({ timeout: 60000 }); // trang nay còn khối link báo cáo ("Mỗi em một link…", tên em) ⇒ chỉ đợi trong bảng
  const heads = await page.getByRole("table").getByRole("columnheader").allInnerTexts();
  check("cột bảng: Học sinh · Email · SĐT · Trường · Tiến độ · Ghi danh · Hồ sơ (không còn cột 'Trạng thái')", heads.map(h => h.trim().toLowerCase()).join("|") === "học sinh|email|sđt|trường|tiến độ|ghi danh|hồ sơ", heads);
  check("Em Một (đang học) → liên kết 'Hồ sơ' tới /lop-cua-toi/hoc-sinh/em/<id>", (await page.getByRole("row", { name: /Em Một/ }).getByRole("link", { name: "Hồ sơ của Em Một" }).getAttribute("href")) === `/lop-cua-toi/hoc-sinh/em/${s1.id}`);
  check("Em Hai (chờ phụ huynh) → chữ 'Chờ đồng ý', KHÔNG có liên kết hồ sơ", await page.getByRole("row", { name: /Em Hai/ }).getByText("Chờ đồng ý").isVisible() && (await page.getByRole("row", { name: /Em Hai/ }).getByRole("link", { name: /Hồ sơ/ }).count()) === 0);
  await shot(page, "course-ops-students");

  check("không lỗi console", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
