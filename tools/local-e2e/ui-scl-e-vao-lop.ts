// SCL nhóm E (21/11/2026) — Vào lớp trên trình duyệt thật (390px). Cần máy chủ dev + Postgres riêng.
// Hành trình: học sinh MỚI mở link mời (chưa có tài khoản) → trang đăng nhập mở sẵn tab Học sinh, không có vòng lặp "Tôi có mã mời"
// → Tạo tài khoản: đúng 3 ô (họ tên, email, mật khẩu), không màn chặn mã email → về thẳng ô nhập mã đã điền sẵn → lớp cũ (joinPolicy null) thành "Gửi yêu cầu"
// → thấy "chờ gia sư duyệt" → gia sư duyệt trong hàng chờ gộp /lop-cua-toi/xin-vao-lop → học sinh vào lớp. Thêm: Mã mời chỉ một nút sao chép + Đổi mã một chạm.
import { BASE, mkTutor, mkCourse, api, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const RUN = Date.now().toString(36);
const noOverflow = (p: Page) => p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 1`) as Promise<boolean>;
const smallButtons = (p: Page) => p.evaluate(`Array.from(document.querySelectorAll("main button, main a[data-kin-nut], form button")).filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 43.5 && !e.closest("nextjs-portal,[data-kin-toast]"); }).map(e => (e.textContent || "").trim().slice(0, 30))`) as Promise<string[]>;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Thử Vào Lớp");
  const C = await mkCourse(T.id, { name: "Toán 10 lớp cũ", joinPolicy: null });
  const ens = await api("POST", `/api/courses/${C.id}/invites`, { as: T, body: { ensure: true } });
  const code: string = ens.json.code;
  await launch();

  section("Học sinh mới mở link mời → trang đăng nhập mở sẵn tab Học sinh");
  const gc = await ctxFor(null, { width: 390, height: 844 });
  await gc.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await gc.setExtraHTTPHeaders({ "x-forwarded-for": `10.96.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  const p = await gc.newPage();
  const errors: string[] = [];
  p.on("pageerror", e => errors.push(String(e)));
  await p.goto(`${BASE}/student/nhap-ma-lop?code=${code}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await eventually("bị đưa sang /dang-nhap (giữ redirect kèm mã)", () => { const u = new URL(p.url()); return u.pathname === "/dang-nhap" && (u.searchParams.get("redirect") ?? "").includes(`code=${code}`); }, 90000);
  await p.getByRole("tab", { name: "Học sinh" }).waitFor({ timeout: 60000 });
  check("CA PHÁ: tab Học sinh được chọn sẵn", (await p.getByRole("tab", { name: "Học sinh" }).getAttribute("aria-selected")) === "true");
  check("có câu hướng dẫn mã mời, KHÔNG có nút 'Tôi có mã mời' (lối vòng lặp cũ)", await p.locator("[data-invite-hint]").isVisible() && (await p.getByRole("link", { name: "Tôi có mã mời vào lớp" }).count()) === 0);
  check("390px không tràn ngang", await noOverflow(p));
  await shot(p, "scl-e-dang-nhap-hoc-sinh-390");

  section("Tạo tài khoản: đúng 3 ô, không màn chặn mã");
  await p.getByRole("link", { name: "Tạo tài khoản KiN" }).click();
  await eventually("tới /dang-ky (giữ redirect)", () => { const u = new URL(p.url()); return u.pathname === "/dang-ky" && (u.searchParams.get("redirect") ?? "").includes(code); }, 60000);
  const f = p.locator("form[data-dang-ky-hoc-sinh]");
  await f.waitFor({ timeout: 60000 });
  const inputs = await f.locator('input:not([type="checkbox"]):not([type="hidden"])').count();
  check("CA PHÁ: biểu mẫu học sinh chỉ có 3 ô nhập (họ tên, email, mật khẩu)", inputs === 3, inputs);
  check("không có ô SĐT / trường / tỉnh", (await f.locator('input[type="tel"], [role="combobox"]').count()) === 0);
  const email = `scl-e-${RUN}@test.local`;
  await p.getByPlaceholder("Nguyễn Văn A").fill("Em Mới Vào Lớp");
  await p.getByPlaceholder("ten@gmail.com").fill(email);
  await p.getByPlaceholder("Tối thiểu 8 ký tự").fill("MatKhau#2026");
  for (let i = 0; i < 5 && !(await f.locator('input[type="checkbox"]').isChecked()); i++) { await f.locator('input[type="checkbox"]').click(); await p.waitForTimeout(300); }
  check("390px không tràn ngang (đăng ký)", await noOverflow(p));
  const small = await smallButtons(p);
  check("nút trong biểu mẫu ≥ 44px", small.length === 0, small);
  await shot(p, "scl-e-dang-ky-3-o-390");
  await p.getByRole("button", { name: "Tạo tài khoản miễn phí" }).click();

  section("Về thẳng ô nhập mã → gửi yêu cầu → chờ duyệt");
  await eventually("tới /student/nhap-ma-lop?code=… (không qua màn nhập mã email)", () => { const u = new URL(p.url()); return u.pathname === "/student/nhap-ma-lop" && u.searchParams.get("code") === code; }, 90000);
  await p.getByText("Bạn sắp xin vào lớp").waitFor({ timeout: 60000 });
  check("xem trước đúng lớp + gia sư", await p.getByText("Toán 10 lớp cũ").isVisible() && await p.getByText("Cô Thử Vào Lớp").first().isVisible());
  await p.getByRole("button", { name: "Gửi yêu cầu vào lớp" }).click();
  await p.getByText("Đã gửi yêu cầu — chờ gia sư duyệt").waitFor({ timeout: 30000 });
  const S = await prisma.user.findUniqueOrThrow({ where: { email } });
  check("DB: có yêu cầu pending, CHƯA có Enrollment (Q7)", (await prisma.classJoinRequest.findFirst({ where: { userId: S.id, courseId: C.id } }))?.status === "pending" && (await prisma.enrollment.count({ where: { userId: S.id, courseId: C.id } })) === 0);
  check("390px không tràn ngang (chờ duyệt)", await noOverflow(p));
  await shot(p, "scl-e-cho-duyet-390");

  section("Gia sư duyệt trong hàng chờ gộp");
  const tc = await ctxFor(T, { width: 390, height: 844 });
  const tp = await tc.newPage();
  await tp.goto(`${BASE}/lop-cua-toi/xin-vao-lop`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await tp.getByRole("heading", { name: "Xin vào lớp (1)" }).waitFor({ timeout: 90000 });
  check("hàng chờ có tên lớp + tên em", await tp.locator("[data-join-queue]").getByText("Toán 10 lớp cũ").isVisible() && await tp.locator("[data-join-queue]").getByText("Em Mới Vào Lớp").isVisible());
  check("390px không tràn ngang (hàng chờ)", await noOverflow(tp));
  const tsmall = await smallButtons(tp);
  check("nút hàng chờ ≥ 44px", tsmall.length === 0, tsmall);
  await shot(tp, "scl-e-hang-cho-390");
  await tp.getByRole("button", { name: "Duyệt Em Mới Vào Lớp" }).click();
  await eventually("303 về hàng chờ + thông báo đã duyệt", async () => new URL(tp.url()).pathname === "/lop-cua-toi/xin-vao-lop" && (await tp.locator('[data-duyet-toast="ok"]').count()) === 1, 60000);
  check("hàng chờ trống có lời giải thích", await tp.getByText("Chưa có ai xin vào lớp").isVisible());
  check("DB: em đã vào lớp", (await prisma.enrollment.findFirst({ where: { userId: S.id, courseId: C.id } }))?.status === "active");

  section("Học sinh thấy lớp; lối Nhập mã lớp ở đầu trang");
  await p.goto(`${BASE}/student/hoc-tap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await eventually("Lớp của tôi có lớp vừa được duyệt", async () => (await p.locator("[data-class-catalog]").count()) === 1 && (await p.locator("[data-class-catalog]").innerText()).includes("Toán 10 lớp cũ"), 90000);
  const top = await p.locator("[data-nhap-ma-dau]").boundingBox();
  check("nút 'Nhập mã lớp' nằm ở đầu trang (y < 400)", !!top && top.y < 400, top);
  check("không lỗi JS ở phía học sinh", errors.length === 0, errors.slice(0, 3));
  await gc.close();

  section("Mã mời: một nút sao chép + Đổi mã một chạm");
  await tp.goto(`${BASE}/lop-cua-toi/quan-lop/${C.id}/hoc-vien?muc=ma-moi`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const how = tp.locator("[data-join-howto]").first();
  await how.locator("[data-class-code]").waitFor({ timeout: 90000 });
  check("khối Cách vào lớp: đúng MỘT nút sao chép (link mời)", (await how.locator("button").filter({ hasText: /Sao chép/ }).count()) === 1 && (await how.getByRole("button", { name: "Sao chép link mời" }).count()) === 1);
  check("ô Cách vào lớp đọc lớp cũ là 'Cô duyệt' (Q7)", (await how.getAttribute("data-policy")) === "approve");
  await how.locator("[data-rotate-code]").click();
  await eventually("bấm Đổi mã → mã trên trang đổi", async () => { const t = (await tp.locator("[data-join-howto] [data-class-code]").first().innerText()).trim(); return t.length === 8 && t !== code; }, 30000);
  check("DB: mã cũ đã thu hồi", (await prisma.classInvite.findUnique({ where: { code } }))?.revoked === true);
  check("390px không tràn ngang (Mã mời)", await noOverflow(tp));
  await shot(tp, "scl-e-ma-moi-390");
  await tc.close();

  section("Đăng nhập thường: 'Tôi có mã mời' không còn vòng lặp");
  const lc = await ctxFor(null, { width: 390, height: 844 });
  const lp = await lc.newPage();
  await lp.goto(`${BASE}/dang-nhap`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await lp.getByRole("tab", { name: "Học sinh" }).waitFor({ timeout: 60000 });
  check("không redirect: mặc định tab Gia sư như cũ", (await lp.getByRole("tab", { name: "Gia sư" }).getAttribute("aria-selected")) === "true");
  await lp.getByRole("tab", { name: "Học sinh" }).click();
  await lp.getByRole("link", { name: "Tôi có mã mời vào lớp" }).click();
  await eventually("ở lại trang đăng nhập, nhớ đích là ô nhập mã, hiện câu hướng dẫn", async () => { const u = new URL(lp.url()); return u.pathname === "/dang-nhap" && u.searchParams.get("redirect") === "/student/nhap-ma-lop" && await lp.locator("[data-invite-hint]").isVisible(); }, 30000);
  check("vẫn ở tab Học sinh", (await lp.getByRole("tab", { name: "Học sinh" }).getAttribute("aria-selected")) === "true");
  await lc.close();

  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
