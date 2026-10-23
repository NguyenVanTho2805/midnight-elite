import { BASE, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

// Ngày tính LÙI từ hôm nay (giờ VN) để test không hỏng khi chạy vào lúc khác: ĐX-05 phụ thuộc cửa sổ "30 ngày qua".
const dayAgo = (n: number) => new Date(`${vnDateKeyOf(new Date(Date.now() - n * 86_400_000))}T00:00:00Z`);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), P = await mkTutor("Thầy Chờ Duyệt"), L = await mkTutor("Cô Bị Khoá");
  await prisma.user.update({ where: { id: T.id }, data: { tutorVerified: true, tutorVerifiedAt: new Date("2026-09-01T00:00:00Z"), bio: "Gia sư Toán 9 nhiều năm.", subjects: ["Toán 9"] } });
  await prisma.user.update({ where: { id: P.id }, data: { tutorVerified: false, bio: "Chờ duyệt", subjects: ["Lý"] } });
  await prisma.user.update({ where: { id: L.id }, data: { tutorVerified: true, profileLockedAt: new Date(), profileLockReason: "x", bio: "Bị khoá", subjects: ["Hoá"] } });
  const c1 = await mkCourse(T.id, { name: "Toán 9", capacity: 5 });
  for (let i = 0; i < 2; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS ${i}` })).id, courseId: c1.id, status: "active" } });
  for (const n of [60, 50, 40]) await mkAttendanceSession(c1.id, T.id, dayAgo(n)); // đều ngoài 30 ngày qua

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); };

  section("Gia sư đã duyệt: xem trước đầu hồ sơ công khai");
  const page = await (await ctxFor(T)).newPage(); watch(page);
  await page.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Hồ sơ gia sư", level: 1 }).waitFor({ timeout: 90000 });
  const sec = page.getByRole("region", { name: /Hồ sơ công khai của bạn trông thế này/ });
  await sec.getByRole("heading", { name: "Cô Lan", level: 2 }).waitFor({ timeout: 30000 });
  check("chỉ MỘT h1 trên trang (phần xem trước dùng h2)", (await page.getByRole("heading", { level: 1 }).count()) === 1);
  const txt = (await sec.innerText()).replace(/\s+/g, " ");
  check("đúng thứ khách thấy: 'Đã xác minh', 'Không thu phí nhận lớp', môn, giới thiệu", txt.includes("Đã xác minh") && txt.includes("Không thu phí nhận lớp") && txt.includes("Toán 9") && txt.includes("Gia sư Toán 9 nhiều năm."), txt);
  check("bốn con số lấy từ sổ lớp: 1 lớp, 2 học viên, 3 buổi đã dạy", /2\s*Học viên/.test(txt) && /1\s*Lớp đang dạy/.test(txt) && /3\s*Buổi đã dạy/.test(txt), txt);
  check("ĐX-05: chưa có buổi nào trong 30 ngày qua → CHƯA có nhãn 'Có dạy trong 30 ngày qua'", (await sec.getByTestId("recently-active").count()) === 0, txt); // không dò theo chữ: dòng giải thích của phần xem trước cũng nhắc tới nhãn này
  check("ĐX-05 (Q3): không có 'đúng hạn %' và không có vế 'phụ huynh xác nhận' trong bản xem trước", !/đúng hạn|phụ huynh xác nhận|%/.test(txt), txt);
  check("nói rõ số buổi/lớp không có ô nhập tay + liên kết tới trang công khai", await sec.getByText(/không có ô nhập tay/).isVisible() && (await sec.getByRole("link", { name: "Mở trang công khai" }).getAttribute("href")) === `/mentor/${T.id}`);
  check("form sửa giới thiệu/môn vẫn có bên dưới", await page.getByRole("button", { name: /Lưu/ }).first().isVisible());
  await shot(page, "profile-preview");

  section("ĐX-05: có buổi đã dạy trong 30 ngày qua → hiện nhãn, số buổi tăng, cùng nhãn ở hồ sơ công khai");
  await mkAttendanceSession(c1.id, T.id, dayAgo(2));
  await page.reload({ waitUntil: "networkidle" });
  const sec2 = page.getByRole("region", { name: /Hồ sơ công khai của bạn trông thế này/ });
  await sec2.getByRole("heading", { name: "Cô Lan", level: 2 }).waitFor({ timeout: 30000 });
  check("xem trước: nhãn 'Có dạy trong 30 ngày qua' hiện, số buổi đã dạy = 4", (await sec2.getByTestId("recently-active").isVisible()) && /4\s*Buổi đã dạy/.test((await sec2.innerText()).replace(/\s+/g, " ")));
  const pub = await (await ctxFor(null)).newPage(); watch(pub);
  await pub.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pub.getByRole("heading", { name: "Cô Lan", level: 1 }).waitFor({ timeout: 60000 });
  check("hồ sơ công khai: cùng nhãn và cùng số buổi (không lệch với xem trước)", (await pub.getByTestId("recently-active").isVisible()) && /4\s*Buổi đã dạy/.test((await pub.locator("body").innerText()).replace(/\s+/g, " ")));
  const lst = await (await ctxFor(null)).newPage(); watch(lst);
  await lst.goto(`${BASE}/giang-vien`, { waitUntil: "networkidle", timeout: 120000 });
  const card = lst.locator("article", { has: lst.locator("h3", { hasText: "Cô Lan" }) });
  await card.waitFor({ timeout: 60000 });
  check("danh sách /giang-vien: thẻ ghi '4 buổi đã dạy' và 'Có dạy trong 30 ngày qua'; mặc định sắp 'Hoạt động gần đây'", /4 buổi đã dạy/.test(await lst.getByTestId("tutor-activity").first().innerText()) && /Có dạy trong 30 ngày qua/.test(await lst.getByTestId("tutor-activity").first().innerText()) && (await lst.locator("#tutor-sort").inputValue()) === "active");

  section("ĐX-06: khai khu vực và hình thức dạy → hiện ở hồ sơ công khai; giá chỉ hiện khi gia sư bật công tắc");
  const form = page.locator("section", { has: page.getByRole("heading", { name: "Khu vực và hình thức dạy" }) });
  check("form có đủ năm mục, nói rõ 'tự khai' và 'không bao giờ hiện địa chỉ nhà', không có ô địa chỉ", await form.getByLabel("Tỉnh/Thành").isVisible() && await form.getByLabel("Quận/Huyện").isVisible() && (await form.getByRole("radio").count()) === 3
    && await form.getByText(/Tự khai/).first().isVisible() && await form.getByText(/không bao giờ hiện địa chỉ nhà/).isVisible() && (await form.getByLabel(/địa chỉ/i).count()) === 0);
  check("công tắc giá mặc định TẮT", (await form.getByRole("switch").getAttribute("aria-checked")) === "false");
  await form.getByLabel("Tỉnh/Thành").fill("tp.hcm");
  await form.getByLabel("Quận/Huyện").fill("Quận 7");
  await form.getByRole("radio", { name: "Dạy trực tiếp", exact: true }).click(); // exact: "Online + dạy trực tiếp" cũng chứa chữ này
  await form.getByLabel(/Trường và bằng cấp chính/).fill("ĐH Bách khoa · Kỹ sư");
  await form.getByLabel("Giá tham khảo mỗi buổi (đồng)").fill("150000");
  check("ô giá chỉ nhận chữ số và hiện bản xem trước '150.000đ / buổi'", await form.getByTestId("gia-xem-truoc").innerText() === "150.000đ / buổi");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await page.getByText("Đã lưu hồ sơ.").waitFor({ timeout: 30000 });
  await page.reload({ waitUntil: "networkidle" });
  const sec3 = page.getByRole("region", { name: /Hồ sơ công khai của bạn trông thế này/ });
  await sec3.getByRole("heading", { name: "Cô Lan", level: 2 }).waitFor({ timeout: 30000 });
  const form2 = page.locator("section", { has: page.getByRole("heading", { name: "Khu vực và hình thức dạy" }) });
  check("tải lại: form điền sẵn đúng (Tỉnh/Thành đã thống nhất 'TP. Hồ Chí Minh')", (await form2.getByLabel("Tỉnh/Thành").inputValue()) === "TP. Hồ Chí Minh" && (await form2.getByLabel("Quận/Huyện").inputValue()) === "Quận 7" && (await form2.getByRole("radio", { name: "Dạy trực tiếp", exact: true }).getAttribute("aria-checked")) === "true");
  const pv = (await sec3.innerText()).replace(/\s+/g, " ");
  check("bản xem trước: 'TP. Hồ Chí Minh · Quận 7', 'Dạy trực tiếp', trường + bằng cấp kèm '(tự khai)'; giá chưa hiện vì công tắc tắt", /TP\. Hồ Chí Minh · Quận 7/.test(pv) && /Dạy trực tiếp/.test(pv) && /ĐH Bách khoa · Kỹ sư \(tự khai\)/.test(pv) && !/150\.000đ/.test(pv), pv);
  await form2.getByRole("switch").click();
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await page.getByText("Đã lưu hồ sơ.").waitFor({ timeout: 30000 });
  const pub2 = await (await ctxFor(null)).newPage(); watch(pub2);
  await pub2.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pub2.getByRole("heading", { name: "Cô Lan", level: 1 }).waitFor({ timeout: 60000 });
  const area = (await pub2.getByTestId("tutor-area").innerText()).replace(/\s+/g, " ");
  check("hồ sơ công khai: khu vực + hình thức + '(tự khai)'; bật công tắc thì hiện '150.000đ / buổi · giá tham khảo'", /TP\. Hồ Chí Minh · Quận 7/.test(area) && /Dạy trực tiếp/.test(area) && /\(tự khai\)/.test(area) && /150\.000đ \/ buổi · giá tham khảo/.test(area), area);
  check("không có địa chỉ nhà / số điện thoại ở khối khu vực", !/đường|ngõ|0\d{9}/i.test(area));
  const lst2 = await (await ctxFor(null)).newPage(); watch(lst2);
  await lst2.goto(`${BASE}/giang-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await lst2.locator("#tutor-city").waitFor({ timeout: 60000 });
  check("/giang-vien: có ô lọc Tỉnh/Thành (từ gia sư đã khai) và Hình thức", (await lst2.locator("#tutor-city option").allInnerTexts()).includes("TP. Hồ Chí Minh") && await lst2.locator("#tutor-mode").isVisible());
  await lst2.locator("#tutor-city").selectOption("TP. Hồ Chí Minh");
  await lst2.locator("h3", { hasText: "Cô Lan" }).waitFor({ timeout: 30000 });
  check("lọc tỉnh 'TP. Hồ Chí Minh' → Cô Lan còn, thẻ có chip khu vực", (await lst2.getByTestId("tutor-area").first().innerText()).includes("Quận 7"));
  await lst2.locator("#tutor-mode").selectOption("online");
  await lst2.getByText("Chưa có gia sư nào phù hợp bộ lọc").waitFor({ timeout: 30000 });
  check("lọc 'Online' → Cô Lan (chỉ dạy trực tiếp) biến mất, hiện gợi ý bỏ bộ lọc", (await lst2.locator("h3", { hasText: "Cô Lan" }).count()) === 0);

  section("Chưa duyệt / bị khoá: không giả vờ có hồ sơ công khai");
  const pp = await (await ctxFor(P)).newPage(); watch(pp);
  await pp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await pp.getByRole("heading", { name: "Hồ sơ gia sư", level: 1 }).waitFor({ timeout: 60000 });
  check("chưa duyệt: 'sẽ hiện ở đây sau khi quản trị viên duyệt', không có tiêu đề gia sư h2", await pp.getByText(/sẽ hiện ở đây sau khi quản trị viên duyệt/).isVisible() && (await pp.getByRole("heading", { name: "Thầy Chờ Duyệt", level: 2 }).count()) === 0);
  const lp = await (await ctxFor(L)).newPage(); watch(lp);
  await lp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await lp.getByRole("heading", { name: "Hồ sơ gia sư", level: 1 }).waitFor({ timeout: 60000 });
  check("bị khoá: báo 'đang bị khoá', không hiện bản xem trước", await lp.getByText(/đang bị khoá nên khách chưa xem được/).isVisible() && (await lp.getByRole("heading", { name: "Cô Bị Khoá", level: 2 }).count()) === 0);

  section("Khoá sau khi mở trang: bản xem trước báo chưa công khai");
  await prisma.user.update({ where: { id: T.id }, data: { profileLockedAt: new Date(), profileLockReason: "x" } });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/đang bị khoá nên khách chưa xem được/).waitFor({ timeout: 30000 });
  check("sau khi bị khoá: chuyển sang thông báo", true);
  await prisma.user.update({ where: { id: T.id }, data: { profileLockedAt: null, profileLockReason: null } });

  section("NC2-022: công tắc Hiện / Ẩn hồ sơ công khai");
  await page.reload({ waitUntil: "networkidle" });
  const sw = page.getByTestId("hien-an-cong-tac"), state = page.getByTestId("hien-an-trang-thai");
  await sw.waitFor({ timeout: 60000 });
  check("mặc định HIỆN: công tắc bật, ghi 'Hiện' + chữ giải thích", (await sw.getAttribute("aria-checked")) === "true" && (await state.innerText()) === "Hiện" && await page.getByText("Phụ huynh có thể tìm thấy và xem hồ sơ của bạn.").isVisible());
  check("bật Hiện không đòi trường/bằng cấp (công tắc không bị khoá)", await sw.isEnabled());
  // Lỗi mạng: chặn PUT → báo lỗi + 'Thử lại', công tắc KHÔNG đổi sang Ẩn
  await page.route("**/api/users/me/tutor-profile", r => (r.request().method() === "PUT" ? r.abort() : r.continue()));
  await sw.click();
  await page.getByRole("alert").filter({ hasText: /Thử lại/ }).waitFor({ timeout: 30000 });
  check("lỗi: hiện lời báo + nút Thử lại; trạng thái vẫn 'Hiện' (chưa lưu được thì không giả vờ đã ẩn)", (await state.innerText()) === "Hiện" && await page.getByRole("button", { name: "Thử lại" }).isVisible());
  await page.unroute("**/api/users/me/tutor-profile");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await page.getByText("Hồ sơ đang ẩn — khách không thấy trang này").waitFor({ timeout: 60000 });
  check("Thử lại thành công: 'Ẩn', chữ giải thích mới, bản xem trước VẪN xem được và ghi 'Hồ sơ đang ẩn'", (await state.innerText()) === "Ẩn" && (await sw.getAttribute("aria-checked")) === "false"
    && await page.getByText("Hồ sơ không hiện trên trang Gia sư và link cũ báo không tìm thấy; lớp và học sinh của bạn không bị ảnh hưởng.").isVisible()
    && await page.getByRole("region", { name: /Hồ sơ công khai của bạn trông thế này/ }).getByRole("heading", { name: "Cô Lan", level: 2 }).isVisible());
  check("DB: preferences.profile.hidden = true", ((await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences as any)?.profile?.hidden === true);
  await page.reload({ waitUntil: "networkidle" });
  await sw.waitFor({ timeout: 60000 });
  check("tải lại: vẫn Ẩn, vẫn xem trước được, dòng 'Hồ sơ đang ẩn' thay link 'Xem hồ sơ công khai'", (await sw.getAttribute("aria-checked")) === "false" && await page.getByText("Hồ sơ đang ẩn — khách không thấy trang này").waitFor({ timeout: 30000 }).then(() => true)
    && (await page.getByRole("link", { name: "Xem hồ sơ công khai" }).count()) === 0 && (await page.getByRole("link", { name: "Mở trang công khai" }).count()) === 0);
  await shot(page, "profile-hidden");

  const pubH = await (await ctxFor(null)).newPage(); watch(pubH);
  await pubH.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pubH.getByRole("heading", { name: "Không tìm thấy gia sư", level: 1 }).waitFor({ timeout: 60000 });
  check("/mentor/[id] khi ẩn: 'Không tìm thấy gia sư', không lộ tên / giới thiệu", !(await pubH.locator("body").innerText()).includes("Cô Lan") && !(await pubH.locator("body").innerText()).includes("Gia sư Toán 9 nhiều năm"));
  check("thẻ xem trước link (og) không lộ gì: tiêu đề chung, không tên gia sư", !/Cô Lan/.test(await pubH.title()) && !/Cô Lan/.test((await pubH.locator('meta[property="og:title"]').first().getAttribute("content").catch(() => "")) ?? "") && (await pubH.locator('meta[name="robots"]').first().getAttribute("content").catch(() => "")) !== null);
  const lstH = await (await ctxFor(null)).newPage(); watch(lstH);
  await lstH.goto(`${BASE}/giang-vien`, { waitUntil: "networkidle", timeout: 120000 });
  await lstH.getByRole("heading", { name: /gia sư/i }).first().waitFor({ timeout: 60000 });
  await lstH.waitForTimeout(1500);
  check("/giang-vien: không còn thẻ Cô Lan", (await lstH.locator("h3", { hasText: "Cô Lan" }).count()) === 0 && !(await lstH.locator("body").innerText()).includes("Cô Lan"));
  const bd = await (await ctxFor(T)).newPage(); watch(bd);
  await bd.goto(`${BASE}/lop-cua-toi/bai-dang`, { waitUntil: "networkidle", timeout: 120000 });
  await bd.getByText("Hồ sơ của bạn đang ẩn nên link trong bài chưa mở được").waitFor({ timeout: 60000 });
  check("bài đăng tìm học sinh: cảnh báo 'đang ẩn nên link chưa mở được' + đường tới Hồ sơ gia sư", await bd.getByRole("link", { name: "Mở hồ sơ gia sư" }).isVisible());

  await sw.click();
  await page.getByText("Phụ huynh có thể tìm thấy và xem hồ sơ của bạn.").waitFor({ timeout: 60000 });
  await page.getByRole("link", { name: "Mở trang công khai" }).waitFor({ timeout: 60000 });
  check("bật Hiện lại: công tắc bật, xem trước trở về bình thường (có link 'Mở trang công khai'), không còn dòng 'đang ẩn'", (await sw.getAttribute("aria-checked")) === "true" && (await page.getByTestId("xem-truoc-dang-an").count()) === 0
    && ((await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences as any)?.profile === undefined);
  await pubH.reload({ waitUntil: "networkidle" });
  await pubH.getByRole("heading", { name: "Cô Lan", level: 1 }).waitFor({ timeout: 60000 });
  check("hồ sơ công khai mở lại ngay (cùng link cũ)", await pubH.getByRole("heading", { name: "Cô Lan", level: 1 }).isVisible());
  // Giữ trạng thái ẨN cho phần 390px bên dưới
  await sw.click();
  await page.getByTestId("xem-truoc-dang-an").waitFor({ timeout: 60000 });

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mp);
  await mp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Cô Lan", level: 2 }).waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const box = await mp.getByTestId("hien-an-cong-tac").boundingBox();
  check("NC2-022 ở 390px (đang ẨN): công tắc cao ≥ 44px, rộng ≥ 44px, nằm trong màn hình; không tràn ngang", !!box && box.height >= 44 && box.width >= 44 && box.x + box.width <= 390 && await mp.getByTestId("xem-truoc-dang-an").isVisible(), box);
  await shot(mp, "profile-preview-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
