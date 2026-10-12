import { mkTutor, mkCourse, mkSuper, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị");
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const mk = async (owner: string, name: string, category: string) => { const c = await mkCourse(owner, { name }); await prisma.course.update({ where: { id: c.id }, data: { category } }); return c; };
  await mk(T.id, "Toán 9 A", "Toán"); await mk(T.id, "Toán 9 B", "Toán"); await mk(T2.id, "Toán 10", "Toán"); await mk(T2.id, "Lý 9", "Lý");

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); };

  section("Gia sư: xem được, không sửa được");
  const tp = await (await ctxFor(T)).newPage(); watch(tp);
  await tp.goto(`${ADMIN}/admin/khoa-hoc/danh-muc`, { waitUntil: "networkidle", timeout: 120000 });
  await tp.getByRole("columnheader", { name: "Khoá của bạn" }).waitFor({ timeout: 90000 });
  check("ghi rõ danh mục dùng chung, chỉ quản trị viên đổi tên", await tp.getByRole("note").filter({ hasText: /dùng chung cho mọi gia sư/ }).isVisible() && await tp.getByRole("note").filter({ hasText: /chỉ quản trị viên được đổi tên/ }).isVisible());
  check("thấy ĐỦ tên (Lý, Toán) — để chọn khi tạo khoá — nhưng đếm chỉ khoá của mình", await tp.getByRole("row", { name: /Toán/ }).innerText().then(t => /\s2\s*Chỉ quản trị viên sửa/.test(t.replace(/\n/g, " "))) && await tp.getByRole("row", { name: /Lý/ }).innerText().then(t => /\s0\s*Chỉ quản trị viên sửa/.test(t.replace(/\n/g, " "))));
  check("KHÔNG có nút '+ Thêm danh mục' và KHÔNG có menu Chỉnh sửa/Xoá", (await tp.getByRole("button", { name: /Thêm danh mục/ }).count()) === 0 && (await tp.getByRole("button", { name: "···" }).count()) === 0);
  check("cột cuối là 'Quyền' + chữ giải thích mỗi dòng", await tp.getByRole("columnheader", { name: "Quyền" }).isVisible() && (await tp.getByText("Chỉ quản trị viên sửa").count()) === 2);
  check("chân trang đếm 'khoá của bạn' (2)", await tp.getByText(/2 danh mục · 2 khoá của bạn/).isVisible());
  await shot(tp, "categories-teacher");

  section("Quản trị: sửa được, cảnh báo ảnh hưởng mọi gia sư");
  const ap = await (await ctxFor(SA)).newPage(); watch(ap);
  await ap.goto(`${ADMIN}/admin/khoa-hoc/danh-muc`, { waitUntil: "networkidle", timeout: 120000 });
  await ap.getByRole("columnheader", { name: "Hành động" }).waitFor({ timeout: 90000 });
  check("cảnh báo: đổi tên ảnh hưởng khoá của TẤT CẢ gia sư", await ap.getByText(/dùng chung cho mọi gia sư/).first().isVisible() && await ap.getByText(/của .tất cả. gia sư|tất cả.? gia sư/i).first().isVisible());
  check("đếm mọi khoá: Toán 3, Lý 1; có nút Thêm danh mục", (await ap.getByRole("row", { name: /Toán/ }).innerText()).replace(/\s+/g, " ").includes(" 3 ") && await ap.getByRole("button", { name: /Thêm danh mục/ }).isVisible());
  await ap.getByRole("button", { name: /Thêm danh mục/ }).click();
  await ap.getByPlaceholder("VD: ĐGNL HSA").fill("Hoá");
  await ap.getByRole("button", { name: "Lưu", exact: true }).click();
  await ap.getByText(/Chưa lưu gì: danh mục "Hoá" chỉ có khi một khoá học dùng tên này/).waitFor({ timeout: 15000 });
  check("thêm danh mục: thông báo TRUNG THỰC (không nói 'đã ghi nhớ' khi chưa lưu gì)", (await ap.getByText(/đã ghi nhớ/).count()) === 0 && (await ap.getByRole("row", { name: /Hoá/ }).count()) === 0);
  const toanRow = ap.getByRole("row", { name: /Toán/ });
  await toanRow.getByRole("button", { name: "···" }).click();
  await ap.getByRole("button", { name: "Chỉnh sửa" }).click();
  await ap.getByPlaceholder("VD: ĐGNL HSA").fill("Toán học");
  await ap.getByRole("button", { name: "Lưu", exact: true }).click();
  await ap.getByText(/Đã cập nhật danh mục và đổi tên trên tất cả khoá học/).waitFor({ timeout: 15000 });
  await eventually("DB: cả 3 khoá của HAI gia sư đã đổi tên", async () => (await prisma.course.count({ where: { category: "Toán học" } })) === 3 && (await prisma.course.count({ where: { category: "Toán" } })) === 0);

  section("Gia sư thấy tên mới; thử đổi tên bằng API trực tiếp vẫn bị chặn");
  await tp.reload({ waitUntil: "networkidle" });
  await tp.getByRole("columnheader", { name: "Khoá của bạn" }).waitFor({ timeout: 60000 });
  check("gia sư thấy 'Toán học'", await tp.getByRole("row", { name: /Toán học/ }).isVisible());
  const direct = await tp.evaluate(`fetch("/api/categories", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ oldName: "Toán học", newName: "Hack" }) }).then(r => r.status)`);
  check("gia sư gọi thẳng PUT → 403, dữ liệu không đổi", direct === 403 && (await prisma.course.count({ where: { category: "Hack" } })) === 0);

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mp);
  await mp.goto(`${ADMIN}/admin/khoa-hoc/danh-muc`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("note").waitFor({ timeout: 60000 });
  check("không tràn ngang (bảng cuộn trong khung)", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
