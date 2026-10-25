// ĐX-07 (NC1-082) — "Mời cả lớp một lần" trên trình duyệt thật: dán danh sách → báo lỗi từng dòng → tạo MỘT mã → soạn tin Zalo từng phụ huynh.
// Điều quan trọng nhất ở đây: số điện thoại phụ huynh KHÔNG rời trình duyệt (không có yêu cầu mạng nào mang số) và KHÔNG còn sau khi tải lại.
// Cần Postgres + Next dev (xem README). Phần thuần: t-bulk-invite-lib.ts.
import { BASE, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

// Dữ liệu mẫu CỐ Ý khác ví dụ trong ô dán (placeholder "Minh Anh, 0912 345 678"): nếu trùng thì bài kiểm "trang không còn tên / số nào" bắt nhầm chính placeholder.
// Số mẫu dùng trong bài kiểm, ở mọi cách viết (liền, cách quãng, bỏ số 0 đầu). Dò đúng các số này, không đoán theo dạng chữ số.
const SAMPLE_PHONES = ["0933111222", "0944333444", "0933 111 222", "0944 333 444", "933111222", "944333444"];
const hasPhone = (s: string) => SAMPLE_PHONES.some(p => s.includes(p));

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Toán 9A" });
  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  const zalo: string[] = [];
  await ctx.route(/\/\/(zalo\.me|chat\.zalo\.me)\//, route => { zalo.push(route.request().url()); void route.fulfill({ status: 200, contentType: "text/html", body: "<title>zalo</title>" }); });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|zalo/i.test(m.text())) errors.push(m.text()); });
  const writes: { url: string; method: string; body: string }[] = [];
  page.on("request", r => { if (!["GET", "HEAD", "OPTIONS"].includes(r.method())) writes.push({ url: r.url(), method: r.method(), body: r.postData() ?? "" }); });
  const clip = () => page.evaluate(() => navigator.clipboard.readText()).catch(() => "");

  section("Mở tab Mã mời của lớp");
  await page.goto(`${BASE}/lop-cua-toi/${c.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("tab", { name: "Mã mời", exact: true }).click();
  const box = page.getByLabel("Danh sách em và số phụ huynh");
  await box.waitFor({ timeout: 90000 });
  const create = page.getByRole("button", { name: "Tạo mã mời và soạn tin" });
  check("chưa dán gì: nút tạo bị khoá, chưa có dòng báo", await create.isDisabled() && (await page.getByText(/em hợp lệ/).count()) === 0);

  section("Dòng lỗi được chỉ rõ, chưa cho tạo");
  await box.fill("Bảo Châu, 0933 111 222\nGia Huy, 0933111\n\nBảo Ngọc");
  await eventually("báo 1 em hợp lệ, dòng 2 (số thiếu chữ số) và dòng 4 (thiếu số), nút vẫn khoá", async () => {
    const t = await page.locator("[id$='-sum']").innerText();
    return t.includes("1 em hợp lệ") && t.includes("Dòng 2:") && t.includes("đang có 7") && t.includes("Dòng 4:") && await create.isDisabled();
  });
  await box.fill("1. Bảo Châu, 0933 111 222\n2. Bảo Long\t0933111222\nGia Huy - 0944 333 444\nGia Huy - 0944333444");
  await eventually("sửa xong: 3 em hợp lệ, bỏ 1 dòng trùng, hai anh em cùng số vẫn giữ, nút mở", async () => {
    const t = await page.locator("[id$='-sum']").innerText();
    return t.includes("3 em hợp lệ") && t.includes("bỏ 1 dòng trùng") && !t.includes("Dòng") && await create.isEnabled();
  });
  await shot(page, "bulk-invite-nhap");

  section("Tạo MỘT mã cho cả lớp");
  const before = writes.length;
  await create.click();
  const codeEl = page.getByTestId("bulk-code");
  await codeEl.waitFor({ timeout: 60000 });
  const code = (await codeEl.innerText()).trim();
  const posts = writes.slice(before).filter(w => w.url.includes(`/api/courses/${c.id}/invites`));
  check("đúng 1 yêu cầu tạo mã; nội dung CHỈ có maxUses (3) và expiresAt", posts.length === 1 && JSON.stringify(Object.keys(JSON.parse(posts[0].body)).sort()) === JSON.stringify(["expiresAt", "maxUses"]) && JSON.parse(posts[0].body).maxUses === 3, posts);
  check("KHÔNG yêu cầu ghi nào (POST/PUT/PATCH/DELETE) mang số điện thoại hay tên em", writes.every(w => !hasPhone(w.body) && !/Bảo Châu|Bảo Lo|Gia Huy/.test(w.body)), writes.map(w => `${w.method} ${w.url}`));
  const inv = await prisma.classInvite.findFirst({ where: { courseId: c.id } });
  const days = inv?.expiresAt ? (inv.expiresAt.getTime() - Date.now()) / 86_400_000 : -1;
  check("DB: một mã, đúng mã trên màn hình, 3 lượt, hạn ~14 ngày", (await prisma.classInvite.count({ where: { courseId: c.id } })) === 1 && inv?.code === code && inv?.maxUses === 3 && days > 13.9 && days < 14.1, { code, inv });
  check("DB: số điện thoại phụ huynh không nằm trong bất kỳ bản ghi mã nào / nhật ký", !hasPhone(JSON.stringify(inv)) && (await prisma.auditLog.findMany({ where: { resourceType: "ClassInvite", resourceId: inv?.id ?? "" } })).every(a => !hasPhone(JSON.stringify(a))));
  const rowsLoc = page.getByRole("list", { name: "Phụ huynh cần nhắn" }).getByRole("listitem");
  check("3 dòng phụ huynh, đều 'Chưa mở Zalo'", (await rowsLoc.count()) === 3 && (await page.getByText("Chưa mở Zalo").count()) === 3);
  check("có lời nhắc: số chỉ nằm trên trình duyệt này, KiN không lưu, KiN chỉ biết 'đã mở Zalo'", await page.getByRole("note").filter({ hasText: "chỉ nằm trên trình duyệt này" }).innerText().then(x => x.includes("chỉ nằm trên trình duyệt này") && x.includes("KiN không lưu") && x.includes("không biết tin đã được gửi")));
  check("ô dán đã được dọn (không còn số điện thoại trong trang)", (await page.getByLabel("Danh sách em và số phụ huynh").count()) === 0);
  await shot(page, "bulk-invite-ket-qua");

  section("Mở Zalo từng phụ huynh");
  await rowsLoc.nth(0).getByRole("button", { name: /^Mở Zalo cho phụ huynh Bảo Châu/ }).click();
  await eventually("mở đúng chat Zalo của số đó; dòng đổi thành 'Đã mở Zalo lúc HH:mm', nút thành 'Mở lại'", async () =>
    zalo.some(u => u.includes("zalo.me/0933111222")) && /Đã mở Zalo lúc \d{2}:\d{2}/.test(await rowsLoc.nth(0).innerText()) && (await rowsLoc.nth(0).getByRole("button", { name: /^Mở lại Zalo cho phụ huynh Bảo Châu/ }).count()) === 1);
  const msg = await clip();
  check("tin đã chép: tự giới thiệu 'đây là Cô Lan', có tên em, tên lớp, link vào lớp với mã điền sẵn và mã lớp; KHÔNG có số điện thoại", msg.includes("đây là Cô Lan") && msg.includes("Bảo Châu") && msg.includes("Toán 9A") && msg.includes(`${BASE}/student/nhap-ma-lop?code=${code}`) && msg.includes(code) && !hasPhone(msg), msg);
  check("hai dòng còn lại vẫn 'Chưa mở Zalo' (không đánh dấu hộ)", (await page.getByText("Chưa mở Zalo").count()) === 2);
  await rowsLoc.nth(1).getByRole("button", { name: /^Chép tin cho phụ huynh/ }).click();
  await eventually("'Chép tin' chép tin của đúng em (Bảo Long) mà KHÔNG đánh dấu là đã mở Zalo", async () => (await clip()).includes("Bảo Long") && (await page.getByText("Chưa mở Zalo").count()) === 2);

  section("Làm đợt mới: hỏi lại khi còn người chưa nhắn");
  await page.getByRole("button", { name: "Làm đợt mới" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor({ timeout: 10000 });
  check("hộp thoại nói còn 2 phụ huynh chưa mở Zalo và mã vẫn dùng được", (await dlg.innerText()).includes("Còn 2 phụ huynh chưa mở Zalo"));
  await dlg.getByRole("button", { name: "Ở lại" }).click();
  check("bấm 'Ở lại': danh sách còn nguyên", (await rowsLoc.count()) === 3);
  await page.getByRole("button", { name: "Làm đợt mới" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Làm đợt mới" }).click();
  await box.waitFor({ timeout: 10000 });
  check("làm đợt mới: ô dán trống, danh sách phụ huynh mất", (await box.inputValue()) === "" && (await page.getByRole("list", { name: "Phụ huynh cần nhắn" }).count()) === 0);

  section("Tải lại: mã còn, số điện thoại không còn ở đâu cả");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Mã mời", exact: true }).click();
  await page.getByText(code, { exact: true }).waitFor({ timeout: 60000 });
  const html = await page.content();
  check("danh sách mã mời có mã vừa tạo, ghi 'Đã dùng 0/3 lượt'", (await page.locator("body").innerText()).replace(/\s+/g, " ").includes("Đã dùng 0/3 lượt"), (await page.locator("body").innerText()).slice(0, 300));
  check("HTML trang không còn số điện thoại phụ huynh nào", !hasPhone(html), SAMPLE_PHONES.filter(p => html.includes(p)));
  check("HTML trang không còn tên em nào", !/Bảo Châu|Bảo Long|Gia Huy/.test(html), ["Bảo Châu", "Bảo Long", "Gia Huy"].filter(n => html.includes(n)));
  check("sessionStorage / localStorage không giữ số điện thoại", await page.evaluate(() => !/0933111222|0944333444/.test(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))));

  section("Điện thoại (390px)");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  await mp.goto(`${BASE}/lop-cua-toi/${c.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("tab", { name: "Mã mời", exact: true }).click();
  const mbox = mp.getByLabel("Danh sách em và số phụ huynh");
  await mbox.waitFor({ timeout: 60000 });
  await mbox.fill("Bảo Châu, 0933111222");
  await mp.getByRole("button", { name: "Tạo mã mời và soạn tin" }).click();
  await mp.getByTestId("bulk-code").waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const bb = await mp.getByRole("button", { name: /^Mở Zalo cho phụ huynh/ }).boundingBox();
  check("nút 'Mở Zalo' cao ≥ 44px", !!bb && bb.height >= 44, bb);
  await shot(mp, "bulk-invite-mobile");

  check("không lỗi trang", errors.length === 0, errors.slice(0, 3));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
