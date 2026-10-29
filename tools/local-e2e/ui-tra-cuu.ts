// NC2-053 — trang /tra-cuu (trình duyệt thật + cơ sở dữ liệu thật): khách chỉ thấy bản che (tên che, số khoá, lối đăng nhập); số phụ huynh không còn tra được;
// chính học sinh đăng nhập thấy đủ; SĐT sai bị báo ngay ở trình duyệt; 390px không tràn ngang; nút bấm ≥ 44px.
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const rnd = () => "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
// Mỗi trình duyệt một IP giả (máy chủ lấy IP cuối của x-forwarded-for): chạy lại bài trong vòng một phút không dính trần 10 lần / phút của lần trước.
const rndIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), C1 = await mkCourse(T.id, { name: "Sử 12 nâng cao" }), C2 = await mkCourse(T.id, { name: "Địa 12" });
  const A = await mkUser({ name: "Nguyễn Văn Thọ" });
  const PA = rnd(), PP = rnd();
  await prisma.user.update({ where: { id: A.id }, data: { phone: PA, parentPhone: PP, studentId: 4242 } });
  for (const c of [C1, C2]) await prisma.enrollment.create({ data: { userId: A.id, courseId: c.id, status: "active" } });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 500)}`); }); };
  // Khi đã đăng nhập, khung trang đổi sang vỏ học sinh sau lần vẽ đầu và ô nhập bị dựng lại → điền lại cho tới khi nút mở (tối đa 6 lần).
  const search = async (p: Page, phone: string) => {
    const btn = p.getByRole("button", { name: "Tra cứu" });
    for (let i = 0; i < 6; i++) {
      await p.fill("input[type=tel]", phone);
      if (await btn.isEnabled({ timeout: 2000 }).catch(() => false) && (await p.inputValue("input[type=tel]")) === phone) { await btn.click({ timeout: 5000 }).catch(() => {}); return; }
      await p.waitForTimeout(700);
    }
    await btn.click();
  };

  section("Khách: chỉ thấy bản che");
  const cg = await ctxFor(null, { width: 1280, height: 900 }); await cg.setExtraHTTPHeaders({ "x-forwarded-for": rndIp() });
  const gp = await cg.newPage(); watch(gp);
  await gp.goto(`${BASE}/tra-cuu`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 });
  const body0 = await gp.locator("main, body").first().innerText();
  check("nhãn ô nhập là 'Số điện thoại đăng ký của học sinh' (không còn 'hoặc phụ huynh')", /Số điện thoại đăng ký của học sinh/.test(body0) && !/học sinh hoặc phụ huynh/.test(body0));
  check("nói rõ số của phụ huynh không dùng để tra cứu, và mã học viên / khoá chỉ hiện cho chính học sinh", /số của phụ huynh không dùng để tra cứu/.test(body0) && /chỉ hiện cho chính học sinh/.test(body0));
  await gp.fill("input[type=tel]", "0|1234567");
  check("SĐT sai (lỗ hổng cũ '0|1234567') → báo 'không hợp lệ', nút Tra cứu bị khoá", /không hợp lệ/.test(await gp.locator("main, body").first().innerText()) && await gp.getByRole("button", { name: "Tra cứu" }).isDisabled());
  await search(gp, PA.slice(0, 4) + " " + PA.slice(4, 7) + " " + PA.slice(7));
  const masked = gp.locator("[data-lookup-masked]");
  await masked.waitFor({ timeout: 30000 });
  const card = (await gp.locator("main, body").first().innerText());
  check("kết quả: tên CHE 'Nguyễn V. T.', 'Đã đăng ký 2 khóa học'", /Nguyễn V\. T\./.test(card) && /Đã đăng ký 2 khóa học/.test(card), card.slice(0, 400));
  check("KHÔNG có tên thật, mã học viên, tên khoá ở bất kỳ đâu trên trang", !/Thọ|HS-4242|4242|Sử 12|Địa 12/.test(card));
  check("nói rõ 'Mã học viên chỉ hiện sau khi đăng nhập' và dòng lưu ý quyền riêng tư", /Mã học viên chỉ hiện sau khi đăng nhập/.test(card) && /chỉ thấy tên đã che và số khóa học/.test(card));
  const loginLink = masked.getByRole("link", { name: "Đăng nhập" }), parentLink = masked.getByRole("link", { name: "Dành cho phụ huynh" });
  check("có lối 'Đăng nhập' → /dang-nhap và 'Dành cho phụ huynh' → /phu-huynh", (await loginLink.getAttribute("href")) === "/dang-nhap" && (await parentLink.getAttribute("href")) === "/phu-huynh");
  check("hai liên kết cao ≥ 44px", ((await loginLink.boundingBox())?.height ?? 0) >= 44 && ((await parentLink.boundingBox())?.height ?? 0) >= 44);
  await shot(gp, "tra-cuu-khach");

  section("Khách: số phụ huynh không còn tra được");
  await search(gp, PP);
  await eventually("tra bằng SĐT phụ huynh → 'Không tìm thấy', không có tên con", async () => { const t = await gp.locator("main, body").first().innerText(); return /Không tìm thấy/.test(t) && !/Nguyễn|Thọ/.test(t) && (await gp.locator("[data-lookup-masked]").count()) === 0; }, 15000);
  await search(gp, rnd());
  await eventually("số không có ai → 'Không tìm thấy'", async () => /Không tìm thấy/.test(await gp.locator("main, body").first().innerText()), 15000);

  section("Chính học sinh đăng nhập: thấy đủ");
  const ca = await ctxFor(A, { width: 1280, height: 900 }); await ca.setExtraHTTPHeaders({ "x-forwarded-for": rndIp() });
  const ap = await ca.newPage(); watch(ap);
  await ap.goto(`${BASE}/tra-cuu`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await ap.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 });
  // Vỏ học sinh dựng sau lần vẽ đầu và dựng lại trang (mất chữ đã gõ + kết quả) → đợi vỏ xuất hiện rồi mới tra.
  await ap.getByText("Không gian học tập").waitFor({ timeout: 60000 });
  await ap.waitForTimeout(1500);
  await search(ap, PA);
  await eventually("A tra số của mình → tên thật, HS-4242, 2 khoá; KHÔNG có khung bản che", async () => { const t = await ap.locator("main, body").first().innerText(); return /Nguyễn Văn Thọ/.test(t) && /HS-4242/.test(t) && /Sử 12 nâng cao/.test(t) && /Địa 12/.test(t) && /\(2\)/.test(t) && (await ap.locator("[data-lookup-masked]").count()) === 0; }, 20000);
  await shot(ap, "tra-cuu-chinh-chu");

  section("390px");
  const cm = await ctxFor(null, { width: 390, height: 844 }); await cm.setExtraHTTPHeaders({ "x-forwarded-for": rndIp() });
  const mp = await cm.newPage(); watch(mp);
  await mp.goto(`${BASE}/tra-cuu`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await mp.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 });
  await search(mp, PA);
  await mp.locator("[data-lookup-masked]").waitFor({ timeout: 30000 });
  check("không tràn ngang ở 390px", (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await shot(mp, "tra-cuu-khach-390");

  check("không lỗi JS / console trên mọi trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
