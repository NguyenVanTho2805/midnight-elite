// Hành trình học sinh MỚI từ đầu đến cuối (16/10/2026; Thọ: "kiểm tra toàn bộ role học sinh và role guest xem có lỗi hay button đến sai địa chỉ").
//   J1  Khách mở trang chủ → "Đăng ký" ở đầu trang → /dang-ky
//   J2  Form 2 bước (học viên) → "Kiểm tra hộp thư" (đúng email vừa nhập)
//   J3  Thư xác thực (đọc từ EMAIL_SINK_DIR) → trang xác thực → tự đăng nhập → ĐI THẲNG vào "Việc của tôi" (trước đây đẩy sang /student/hoc-tap, trang "Chưa có khóa học nào",
//       dù trang ghi "Đang chuyển đến Dashboard")
//   J4  Nhập mã mời của gia sư → "Vào lớp này" → /student/hoc-tap?course=<lớp> (quyết định: thành công vào thẳng lớp)
//   J5  Đăng xuất → về trang chủ của khách; mở lại trang học sinh → bị đưa sang /dang-nhap GIỮ ?redirect= đúng trang
//   J6  Đăng nhập lại bằng tài khoản vừa tạo → về đúng trang đang định vào
// Bài `ui-role-everything` không làm được việc này (nó bỏ qua nút gửi / đăng ký / đăng xuất để không làm bẩn dữ liệu); các bước có đổi dữ liệu nằm ở đây.
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const SINK = process.env.EMAIL_SINK_DIR;
if (!SINK) { console.error("Cần EMAIL_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }
type Mail = { to: string; subject: string; html?: string; text?: string };
const mails = (to: string): Mail[] => readdirSync(SINK).sort().map(f => JSON.parse(readFileSync(join(SINK, f), "utf8")) as Mail).filter(m => m.to === to);
const pathOf = (url: string) => { const u = new URL(url); return u.pathname + u.search; };

(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true });
  await wipe();
  const T = await mkTutor("Cô Hoa (hành trình)");
  const C = await mkCourse(T.id, { name: "Toán 9 — lớp mới" });
  const invite = await prisma.classInvite.create({ data: { courseId: C.id, code: `NEW${Date.now().toString(36).toUpperCase().slice(-5)}`, maxUses: 5, createdBy: T.id } });
  const stamp = Date.now().toString(36);
  const email = `hs-moi-${stamp}@test.local`;

  await launch();
  const errors: string[] = [];
  const ctx = await ctxFor(null, { width: 1280, height: 900 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.setExtraHTTPHeaders({ "x-forwarded-for": `10.97.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });   // không vướng giới hạn tốc độ theo IP
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(String(e)));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|status of 4\d\d/i.test(m.text())) errors.push(m.text()); });
  const settle = async () => { await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); };
  const at = () => new URL(p.url());

  section("J1. Khách mở trang chủ → bấm 'Đăng ký' ở đầu trang");
  await p.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await p.locator('header a[href="/dang-ky"]').first().click();
  await eventually("tới /dang-ky", () => at().pathname === "/dang-ky", 30000);
  check("trang đăng ký hiện form học viên (mặc định)", await p.getByText("Họ và tên *").first().isVisible().catch(() => false));

  section("J2. Form hai bước → 'Kiểm tra hộp thư'");
  await p.getByPlaceholder("Nguyễn Văn A").fill("Học Sinh Mới");
  await p.locator('input[type="tel"]').nth(0).fill("0912345678");
  await p.locator('input[type="tel"]').nth(1).fill("0987654321");
  await p.locator("form select").first().selectOption({ index: 1 });
  await p.getByPlaceholder("THPT Chu Văn An").fill("THCS Thử Nghiệm");
  await p.getByRole("button", { name: /Tiếp theo/ }).click();
  await p.getByPlaceholder("ten@gmail.com").waitFor({ timeout: 20000 });
  await p.getByPlaceholder("ten@gmail.com").fill(email);
  await p.getByPlaceholder("Tối thiểu 8 ký tự").fill("Passw0rd!");
  await p.getByPlaceholder("Nhập lại mật khẩu").fill("Passw0rd!");
  await p.locator('form input[type="checkbox"]').check();   // "form": thanh công cụ dev (agentation) cũng có ô tích, bộ chọn trần khớp 6 phần tử
  await p.getByRole("button", { name: "Tạo tài khoản miễn phí" }).click();
  await eventually("hiện 'Kiểm tra hộp thư'", async () => (await p.locator("body").innerText()).includes("Kiểm tra hộp thư"), 40000);
  check("trang nói đúng email vừa nhập", (await p.locator("body").innerText()).includes(email));

  section("J3. Thư xác thực → trang xác thực → vào thẳng 'Việc của tôi'");
  await eventually("thư xác thực đã được gửi tới email đó", () => mails(email).some(m => /xác thực/i.test(m.subject)), 20000);
  const mail = mails(email).find(m => /xác thực/i.test(m.subject))!;
  const link = `${mail.html ?? ""}\n${mail.text ?? ""}`.match(/https?:\/\/[^"'\s<>]*xac-thuc-email\?token=[A-Za-z0-9_\-%.]+/)?.[0];
  check("thư có liên kết xác thực", !!link, (mail.html ?? mail.text ?? "").slice(0, 200));
  await p.goto(`${BASE}${pathOf(link!)}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await eventually("trang báo 'Xác thực thành công'", async () => (await p.locator("body").innerText()).includes("Xác thực thành công"), 40000);
  await eventually("tự chuyển tới 'Việc của tôi' (trang đầu của học sinh), không phải /student/hoc-tap", () => at().pathname === "/student/viec-cua-toi", 20000);
  await eventually("trong khung học sinh (thanh module HỌC SINH hiện ra)", async () => (await p.locator('nav[aria-label="Module của học sinh"]').count()) > 0, 30000);

  section("J4. Nhập mã mời → 'Vào lớp này' → vào thẳng lớp");
  await p.goto(`${BASE}/student/nhap-ma-lop?code=${invite.code}`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("button", { name: "Vào lớp này" }).click();
  await eventually("tới /student/hoc-tap?course=<lớp>", () => at().pathname === "/student/hoc-tap" && at().searchParams.get("course") === C.id, 40000);
  await eventually("trang lớp hiện đúng tên lớp", async () => (await p.locator("body").innerText()).includes("Toán 9 — lớp mới"), 30000);
  const enr = await prisma.enrollment.findFirst({ where: { courseId: C.id, user: { email } } });
  check("đã ghi danh vào lớp", enr?.status === "active", enr?.status);

  section("J5. Đăng xuất → trang chủ khách; mở lại trang học sinh → sang đăng nhập, giữ ?redirect=");
  await p.getByRole("button", { name: /^Tài khoản của/ }).click();
  await p.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await eventually("về trang chủ của khách (không phải trang đăng nhập kèm ?redirect=: đăng xuất là tải cứng về '/')", () => at().pathname === "/", 30000);
  await settle();
  check("trang chủ hiện thanh trên của khách (không còn khung học sinh)", (await p.locator('header nav[aria-label="Điều hướng chính"]').count()) > 0 && (await p.locator('nav[aria-label="Module của học sinh"]').count()) === 0);
  await p.goto(`${BASE}/student/lich-hoc`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await eventually("mở /student/lich-hoc → /dang-nhap?redirect=/student/lich-hoc", () => at().pathname === "/dang-nhap" && at().searchParams.get("redirect") === "/student/lich-hoc", 30000);

  section("J6. Đăng nhập lại → về đúng trang đang định vào");
  await p.locator('input[type="email"], input[autocomplete="username"], input[name="email"]').first().fill(email);
  await p.locator('input[type="password"]').first().fill("Passw0rd!");
  await p.locator('form button[type="submit"]').first().click();
  await eventually("về đúng /student/lich-hoc", () => at().pathname === "/student/lich-hoc", 40000);

  check("không có lỗi JS / console.error trong cả hành trình", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
