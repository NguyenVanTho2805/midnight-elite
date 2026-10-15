// Đăng ký gia sư — chỉ hỏi những gì cần (15/10/2026). Trình duyệt thật + API.
// Thọ: "phần đăng ký gia sư có một số ô thông tin không cần thiết". Rà theo nơi dùng thật:
//   - SĐT phụ huynh: vô nghĩa với gia sư; máy chủ register-tutor KHÔNG đọc → thu rồi bỏ lặng lẽ.
//   - Trường / nơi học-làm: máy chủ KHÔNG lưu, quản trị cũng không xem → thu rồi bỏ lặng lẽ.
//   - Tỉnh / thành phố: máy chủ lưu nhưng không nơi nào dùng (chỉ in cạnh tên trong danh sách duyệt) → bỏ cho gia sư.
//   Giữ: họ tên, số điện thoại (Zalo — quản trị liên hệ xác minh), giới thiệu ≥ 30 ký tự + môn dạy (để duyệt), email, mật khẩu.
// Học viên giữ nguyên các ô cũ.
import { BASE, mkSuper, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, ADMIN } from "./ui";
import type { Page } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const A = await mkSuper("Admin TSIX");
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of 4\d\d/i.test(m.text())) errors.push(m.text()); });
  };
  let ip = Math.floor(Math.random() * 200);
  const guest = async () => {
    const c = await ctxFor(null, { width: 1280, height: 1000 });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await c.setExtraHTTPHeaders({ "x-forwarded-for": `10.96.${Math.floor(Math.random() * 250)}.${++ip % 250}` });
    return c;
  };
  const stamp = Date.now().toString(36);
  const label = (p: Page, t: string | RegExp) => p.locator("label").filter({ hasText: t });

  const c1 = await guest();
  const p = await c1.newPage(); watch(p);
  await p.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("button", { name: /^Học viên/ }).waitFor({ timeout: 90000 });

  section("Học viên (mặc định): giữ đủ các ô cũ");
  for (const t of ["Họ và tên *", "SĐT học sinh (Zalo) *", "SĐT phụ huynh", "Tỉnh / Thành phố *", "Tên trường *"]) {
    check(`học viên có ô '${t}'`, (await label(p, t).count()) >= 1);
  }
  check("học viên KHÔNG thấy 'Giới thiệu bản thân' và 'Môn dạy'", (await label(p, "Giới thiệu bản thân").count()) === 0 && (await label(p, "Môn dạy").count()) === 0);
  await shot(p, "register-ui-hoc-vien");

  section("Gia sư: chỉ còn những ô cần để duyệt hồ sơ");
  await p.getByRole("button", { name: /^Gia sư/ }).click();
  await label(p, "Giới thiệu bản thân").waitFor({ timeout: 30000 });
  for (const t of ["Họ và tên *", "Số điện thoại (Zalo) *", "Giới thiệu bản thân", "Môn dạy *"]) {
    check(`gia sư có ô '${t}'`, (await label(p, t).count()) === 1);
  }
  check("nhãn số điện thoại của gia sư KHÔNG còn là 'SĐT học sinh' (nhãn sai trước đây)", (await label(p, "SĐT học sinh").count()) === 0);
  for (const t of ["SĐT phụ huynh", "Tỉnh / Thành phố", "Tên trường", "Trường / nơi học"]) {
    check(`gia sư KHÔNG còn ô '${t}'`, (await label(p, t).count()) === 0);
  }
  check("không còn ô chọn tỉnh/thành, ô trường, ô SĐT phụ huynh trong form (đếm ô nhập)", (await p.locator("form select").count()) === 0 && (await p.locator('form input[type="tel"]').count()) === 1 && (await p.locator('form input[type="text"]').count()) === 1);
  check("có câu giải thích số điện thoại dùng để làm gì và không hiện công khai", await p.getByText(/Quản trị KiN dùng số này để liên hệ xác minh/).isVisible() && await p.getByText(/không hiện công khai/).isVisible());
  check("còn lời nhắc hồ sơ chờ admin duyệt", await p.getByText(/chờ admin duyệt/).isVisible());
  await shot(p, "register-ui-gia-su");

  section("Gia sư bấm 'Tiếp theo' để trống: báo đúng 4 ô bắt buộc, không đòi tỉnh/thành hay trường");
  await p.getByRole("button", { name: /Tiếp theo/ }).click();
  const msgs = await p.locator("form p").allInnerTexts();
  const has = (re: RegExp) => msgs.some(m => re.test(m));
  check("báo thiếu họ tên, số điện thoại, giới thiệu, môn dạy", has(/nhập họ và tên/) && has(/số điện thoại/) && has(/vài dòng giới thiệu/) && has(/ít nhất 1 môn/), msgs);
  check("KHÔNG báo thiếu tỉnh/thành hay tên trường", !has(/tỉnh/i) && !has(/tên trường/i), msgs);

  section("Chuyển qua lại giữa hai vai: các ô đổi đúng theo vai");
  await p.getByRole("button", { name: /^Học viên/ }).click();
  check("quay lại Học viên: các ô học viên hiện lại", (await label(p, "SĐT phụ huynh").count()) === 1 && (await label(p, "Tên trường *").count()) === 1 && (await label(p, "Giới thiệu bản thân").count()) === 0);
  await p.getByRole("button", { name: /^Gia sư/ }).click();
  check("sang Gia sư lần nữa: lại gọn", (await label(p, "SĐT phụ huynh").count()) === 0 && (await label(p, "Giới thiệu bản thân").count()) === 1);

  section("Gia sư nộp đơn: máy chủ chỉ nhận đúng các trường cần");
  let sent: Record<string, unknown> | null = null;
  await p.route("**/api/auth/register-tutor", async route => { sent = JSON.parse(route.request().postData() ?? "{}"); await route.continue(); });
  const tutorEmail = `gs-${stamp}@test.local`;
  await p.getByPlaceholder("Nguyễn Văn A").fill("Cô Lan Anh");
  await p.getByPlaceholder("0901 234 567").fill("0912 345 678");
  await p.getByPlaceholder(/Mình là sinh viên năm 3/).fill("Cử nhân Toán, 3 năm dạy ôn ĐGNL cho học sinh lớp 12, hay dùng đề thật để luyện.");
  await p.getByRole("button", { name: "Toán", exact: true }).click();
  await p.getByRole("button", { name: "Vật lý", exact: true }).click();
  await p.getByRole("button", { name: /Tiếp theo/ }).click();
  await p.getByPlaceholder("ten@gmail.com").waitFor({ timeout: 30000 });
  await p.getByPlaceholder("ten@gmail.com").fill(tutorEmail);
  await p.getByPlaceholder("Tối thiểu 8 ký tự").fill("MatKhau#2026");
  await p.getByPlaceholder("Nhập lại mật khẩu").fill("MatKhau#2026");
  await p.locator('form input[type="checkbox"]').check();
  await p.getByRole("button", { name: /Tạo tài khoản|Đăng ký/ }).last().click();
  await p.getByText(/Kiểm tra email|Đăng ký thành công|đã gửi/i).first().waitFor({ timeout: 90000 });
  const sentKeys = Object.keys(sent ?? {}).sort();
  check("thân gửi lên chỉ gồm: bio, email, name, password, phone, subjects (không parentPhone / school / city)", JSON.stringify(sentKeys) === JSON.stringify(["bio", "email", "name", "password", "phone", "subjects"]), sentKeys);
  const u = await prisma.user.findUnique({ where: { email: tutorEmail } });
  check("tài khoản tạo ra: vai học viên chờ duyệt (tutorAppliedAt), đúng tên / số / giới thiệu / môn", !!u && u.role === "student" && !!u.tutorAppliedAt && u.name === "Cô Lan Anh" && u.phone === "0912345678" && (u.bio ?? "").startsWith("Cử nhân Toán") && JSON.stringify(u.subjects) === JSON.stringify(["Toán", "Vật lý"]), u && { role: u.role, phone: u.phone, subjects: u.subjects });
  check("KHÔNG lưu SĐT phụ huynh, trường, tỉnh/thành", !!u && u.parentPhone === null && u.school === null && u.city === null);
  await shot(p, "register-ui-gia-su-xong");

  section("Học viên vẫn đăng ký được như cũ (gửi đủ các trường cũ, lưu đủ)");
  const c2 = await guest();
  const s = await c2.newPage(); watch(s);
  await s.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle", timeout: 120000 });
  let sentS: Record<string, unknown> | null = null;
  await s.route("**/api/auth/register", async route => { sentS = JSON.parse(route.request().postData() ?? "{}"); await route.continue(); });
  const stuEmail = `hv-${stamp}@test.local`;
  await s.getByPlaceholder("Nguyễn Văn A").fill("Minh Anh");
  const tels = s.locator('form input[type="tel"]');
  await tels.nth(0).fill("0901 234 567"); await tels.nth(1).fill("0987 654 321");
  await s.locator("form select").selectOption({ index: 1 });
  await s.getByPlaceholder("THPT Chu Văn An").fill("THPT Chu Văn An");
  await s.getByRole("button", { name: /Tiếp theo/ }).click();
  await s.getByPlaceholder("ten@gmail.com").fill(stuEmail);
  await s.getByPlaceholder("Tối thiểu 8 ký tự").fill("MatKhau#2026");
  await s.getByPlaceholder("Nhập lại mật khẩu").fill("MatKhau#2026");
  await s.locator('form input[type="checkbox"]').check();
  await s.getByRole("button", { name: /Tạo tài khoản|Đăng ký/ }).last().click();
  await s.getByText(/Kiểm tra email|Đăng ký thành công|đã gửi/i).first().waitFor({ timeout: 90000 });
  check("học viên gửi đủ parentPhone / city / school", ["parentPhone", "city", "school"].every(k => typeof (sentS as Record<string, unknown> | null)?.[k] === "string" && ((sentS as Record<string, unknown>)[k] as string).length > 0), Object.keys(sentS ?? {}));
  const us = await prisma.user.findUnique({ where: { email: stuEmail } });
  check("học viên được lưu đủ SĐT phụ huynh, trường, tỉnh/thành", !!us && us.parentPhone === "0987654321" && us.school === "THPT Chu Văn An" && !!us.city, us && { p: us.parentPhone, s: us.school, c: us.city });
  await c2.close();

  section("Máy chủ register-tutor: kiểm số điện thoại và bỏ qua trường thừa");
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch(`${BASE}/api/auth/register-tutor`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.95.${Math.floor(Math.random() * 250)}.${++ip % 250}` }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };
  const base = (n: string) => ({ name: "Thầy Nam", email: `api-${n}-${stamp}@test.local`, password: "MatKhau#2026", bio: "Giáo viên Vật lý 10 năm kinh nghiệm luyện thi đại học và ĐGNL.", subjects: ["Vật lý"] });
  check("thiếu số điện thoại → 400", (await post({ ...base("a") })).status === 400);
  check("số điện thoại sai (số bàn, quá ngắn, chữ) → 400 nêu 'không hợp lệ'", (await Promise.all(["0241234567", "09012345", "abc", "+8490123"].map((ph, i) => post({ ...base(`b${i}`), phone: ph })))).every(r => r.status === 400 && /không hợp lệ/.test(r.json?.error ?? "")));
  check("số điện thoại không phải chuỗi → 400", (await post({ ...base("c"), phone: 912345678 })).status === 400);
  const okR = await post({ ...base("d"), phone: "+84 912 345 678", parentPhone: "0987654321", school: "THPT X", city: "Hà Nội" });
  check("số hợp lệ (dạng +84) + trường thừa → 201, đơn pending", okR.status === 201 && okR.json?.tutorApplication === "pending", okR);
  const ud = await prisma.user.findUnique({ where: { email: base("d").email } });
  check("trường thừa (parentPhone / school / city) bị bỏ, không lưu", !!ud && ud.parentPhone === null && ud.school === null && ud.city === null);
  check("số điện thoại lưu dạng liền (bỏ khoảng trắng)", ud?.phone === "+84912345678", ud?.phone);

  section("Quản trị duyệt hồ sơ: vẫn thấy tên, email, số điện thoại, giới thiệu, môn dạy");
  const ca = await ctxFor(A, { width: 1280, height: 900 }); await ca.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const ap = await ca.newPage(); watch(ap);
  await ap.goto(`${ADMIN}/admin/ho-so-gia-su`, { waitUntil: "networkidle", timeout: 120000 });
  const card = ap.locator("li, div").filter({ hasText: "Cô Lan Anh" }).filter({ hasText: tutorEmail }).first();
  await card.waitFor({ timeout: 90000 });
  const cardText = await card.innerText();
  check("thẻ duyệt hiện tên, email, số điện thoại, giới thiệu, môn", cardText.includes("Cô Lan Anh") && cardText.includes(tutorEmail) && cardText.includes("0912345678") && cardText.includes("Cử nhân Toán") && cardText.includes("Vật lý"), cardText.slice(0, 200));
  check("không hiện tỉnh/thành trống kiểu ' · ' thừa", !/·\s*$/.test(cardText.split("\n")[1] ?? ""));
  await ca.close();

  check("không lỗi JavaScript / console", errors.length === 0, errors.slice(0, 4));
  await c1.close();
  await closeAll();
  await done();
})();
