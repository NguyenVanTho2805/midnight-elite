// Trang /tra-cuu (khách, không đăng nhập) trong trình duyệt thật: chỉ hiện tên che bớt + mã học viên, KHÔNG có danh sách lớp;
// số tự khai không ra gì; 503 (SMS tắt) và 429 hiện đúng lời; 390px không tràn ngang. Cần SMS_SINK_DIR như t-tra-cuu.ts.
import { BASE, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll } from "./ui";

if (!process.env.SMS_SINK_DIR) { console.error("Cần SMS_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }

const RUN = Math.floor(Math.random() * 90_000_000) + 10_000_000;
const phoneOf = (n: number) => `09${String(RUN + n).slice(-8)}`;
const e164Of = (n: number) => `+84${phoneOf(n).slice(1)}`;

(async () => {
  await wipe();
  const A = await mkUser({ name: "Nguyễn Minh Anh" });
  await prisma.user.update({ where: { id: A.id }, data: { studentId: 880_001, phone: phoneOf(1), phoneE164: e164Of(1), phoneVerifiedAt: new Date() } });
  const course = await mkCourse(null, { name: "Lớp Toán Bí Mật Của A" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: course.id } });
  const B = await mkUser({ name: "Trần Thị Bích Ngọc" });
  await prisma.user.update({ where: { id: B.id }, data: { studentId: 880_002, phone: phoneOf(2), parentPhone: phoneOf(3) } });
  const courseB = await mkCourse(null, { name: "Lớp Lý Riêng Của B" });
  await prisma.enrollment.create({ data: { userId: B.id, courseId: courseB.id } });

  await launch();
  const errors: string[] = [];
  const open = async (width: number) => {
    const ctx = await ctxFor(null, { width, height: 900 });
    const p = await ctx.newPage();
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration/i.test(m.text())) errors.push(m.text()); });
    await p.goto(`${BASE}/tra-cuu`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
    return p;
  };
  const search = async (p: Awaited<ReturnType<typeof open>>, phone: string) => {
    await p.getByPlaceholder("0901 234 567").fill(phone);
    await p.getByRole("button", { name: "Tra cứu" }).click();
  };

  section("Số đã xác minh: tên che bớt + mã học viên");
  const p = await open(390);
  const intro = await p.locator("body").innerText();
  check("lời giới thiệu nói đúng: số đã xác minh bằng mã SMS, không còn hứa 'khóa học đã đăng ký' / 'phụ huynh'", /đã xác minh/.test(intro) && !/khóa học đã đăng ký/i.test(intro) && !/SĐT phụ huynh/.test(intro), intro.slice(0, 400));
  await search(p, phoneOf(1));
  await p.getByText("HS-880001").waitFor({ timeout: 30000 });
  const body = await p.locator("main").innerText(); // chỉ vùng nội dung: thanh trên / chân trang có chữ riêng của chúng
  check("hiện 'N••• M••• A•••' và HS-880001", body.includes("N••• M••• A•••") && body.includes("HS-880001"), body);
  check("KHÔNG có tên đầy đủ (Nguyễn / Minh / Anh)", !/Nguyễn|Minh|\bAnh\b/.test(body));
  check("KHÔNG có danh sách lớp: không 'KHÓA HỌC ĐÃ ĐĂNG KÝ', không tên lớp", !/KHÓA HỌC ĐÃ ĐĂNG KÝ/.test(body) && !body.includes("Lớp Toán Bí Mật Của A"));
  check("ghi chú cuối nói đúng điều trang làm (chữ cái đầu + mã; lớp xem sau khi đăng nhập)", /chữ cái đầu/.test(body) && /sau khi đăng nhập/.test(body));
  check("390px: không tràn ngang", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  section("Số tự khai (của em hoặc của phụ huynh): không ra gì");
  for (const [n, what] of [[2, "số tự khai của em"], [3, "số phụ huynh tự khai"]] as const) {
    await search(p, phoneOf(n));
    await p.getByText("Không tìm thấy", { exact: true }).first().waitFor({ timeout: 30000 });
    const t = await p.locator("main").innerText();
    check(`${what} → 'Không tìm thấy', không tên / lớp / mã của B`, !/Trần|Bích|Ngọc|T••• T•••|HS-880002|Lớp Lý Riêng Của B/.test(t), t);
  }

  section("Số sai dạng: chặn ngay ở trang");
  await p.getByPlaceholder("0901 234 567").fill("12345");
  check("số sai → nút Tra cứu bị khoá + báo 'không hợp lệ'", await p.getByRole("button", { name: "Tra cứu" }).isDisabled() && (await p.locator("body").innerText()).includes("Số điện thoại không hợp lệ"));
  await p.getByPlaceholder("0901 234 567").fill("+84 " + phoneOf(1).slice(1));
  check("số gõ kiểu +84 được nhận (khớp cách máy chủ chuẩn hoá)", await p.getByRole("button", { name: "Tra cứu" }).isEnabled());

  section("SMS tắt (503) và quá nhiều lượt (429): lời đúng, không giả vờ 'không tìm thấy'");
  for (const [status, title, code] of [[503, "Chưa mở", "sms-off"], [429, "Thử lại sau", undefined]] as const) {
    await p.route("**/api/tra-cuu", route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: status === 503 ? "Tra cứu theo số điện thoại chưa mở." : "Quá nhiều yêu cầu. Vui lòng thử lại sau.", code }) }));
    await search(p, phoneOf(1));
    await p.getByText(title, { exact: true }).waitFor({ timeout: 30000 });
    const t = await p.locator("main").innerText();
    check(`${status} → tiêu đề '${title}', không có 'Không tìm thấy'`, !t.includes("Không tìm thấy") && t.includes(status === 503 ? "chưa mở" : "Quá nhiều yêu cầu"), t);
    await p.unroute("**/api/tra-cuu");
  }

  section("Bí danh /student/tra-cuu (học sinh đã đăng nhập) vẫn về /tra-cuu");
  const ctx2 = await ctxFor(A, { width: 1280, height: 900 });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/student/tra-cuu`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await p2.getByPlaceholder("0901 234 567").waitFor({ timeout: 90000 });
  check("đã đăng nhập mở /student/tra-cuu → ở /tra-cuu, có ô nhập số", new URL(p2.url()).pathname === "/tra-cuu", p2.url());

  check("không có lỗi JS / console.error trong cả phiên", errors.length === 0, errors);
  await closeAll();
  await done();
})();
