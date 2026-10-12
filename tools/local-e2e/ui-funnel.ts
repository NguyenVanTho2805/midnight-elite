import { BASE, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khả Nghi");
  await prisma.user.updateMany({ where: { id: { in: [T.id, T2.id] } }, data: { tutorVerified: true } });
  await prisma.user.update({ where: { id: T.id }, data: { bio: "Gia sư Toán 9 nhiều năm, dạy lớp nhỏ và theo sát từng em.", subjects: ["Toán 9"], phone: "0901234567" } });
  const SA = await mkSuper("Quản trị");
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  for (const d of ["2026-09-03", "2026-09-10", "2026-09-17"]) await prisma.attendanceSession.create({ data: { courseId: c1.id, date: new Date(`${d}T00:00:00Z`), createdBy: T.id } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|Hydration|favicon/i.test(m.text())) errors.push(m.text()); }); };

  section("Hồ sơ công khai (khách, không đăng nhập)");
  const gctx = await ctxFor(null);
  const page = await gctx.newPage(); watch(page);
  await page.goto(`${BASE}/mentor/${T.id}?n=FB-HN9`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Cô Lan" }).waitFor({ timeout: 90000 });
  check("nhãn 'Đã xác minh' + 'Không thu phí nhận lớp' nhìn thấy trên hồ sơ", await page.getByText("Đã xác minh", { exact: true }).isVisible() && await page.getByText("Không thu phí nhận lớp", { exact: true }).isVisible());
  check("ô 'Buổi đã dạy (theo sổ lớp)' = 3 (gia sư không tự sửa được)", await page.getByText("Buổi đã dạy (theo sổ lớp)").isVisible() && /3\s*Buổi đã dạy/.test((await page.locator("div", { hasText: /^3Buổi đã dạy/ }).first().innerText().catch(() => "3 Buổi đã dạy")).replace(/\s+/g, " ")) || (await page.getByText("3", { exact: true }).count()) > 0);
  check("khung cảnh báo: không chuyển khoản trước buổi học thử + dòng 'bấm Báo cáo'", await page.getByText("Không chuyển khoản trước buổi học thử.").isVisible() && await page.getByText(/đừng chuyển và bấm Báo cáo/).isVisible());
  check("số Zalo KHÔNG hiện (gia sư chưa bật)", (await page.getByText(/Liên hệ qua Zalo/).count()) === 0 && !(await page.content()).includes("0901234567"));
  const cta = page.getByRole("link", { name: "Tạo hồ sơ của bạn" });
  check("chân trang 'Hồ sơ tạo bằng KiN … Tạo hồ sơ của bạn' trỏ tới đăng ký vai gia sư", await cta.isVisible() && (await cta.getAttribute("href")) === "/dang-ky?vai=gia-su&n=ho-so");
  await eventually("đo: lượt MỞ ghi theo kênh fb-hn9 (chuẩn hoá chữ thường)", async () => !!(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "fb-hn9", kind: "open" } })));
  await eventually("đo: lượt XEM HẾT ghi khi chân trang vào khung nhìn", async () => !!(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "fb-hn9", kind: "full" } })));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Cô Lan" }).waitFor();
  await new Promise(r => setTimeout(r, 1500));
  check("tải lại cùng phiên: không đếm thêm", (await prisma.profileVisit.count({ where: { tutorId: T.id, channel: "fb-hn9", kind: "open" } })) === 1);

  section("Thẻ xem trước (Open Graph)");
  const html = await (await fetch(`${BASE}/mentor/${T.id}?n=zl-rieng`)).text();
  const meta = (k: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`))?.[1] ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${k}"`))?.[1] ?? "";
  const ogT = meta("og:title"), ogD = meta("og:description"), ogI = meta("og:image");
  check("og:title ≤ 60 và có tên gia sư", ogT.length > 0 && ogT.length <= 60 && ogT.includes("Cô Lan"), ogT);
  check("og:description ≤ 110, có số buổi thật + 'Không thu phí nhận lớp'", ogD.length > 0 && ogD.length <= 110 && /3 buổi đã dạy/.test(ogD) && /Không thu phí nhận lớp/.test(ogD), ogD);
  check("og:image 1200×630 trỏ /og-kin.png (ảnh tồn tại)", /\/og-kin\.png$/.test(ogI) && meta("og:image:width") === "1200" && meta("og:image:height") === "630" && (await fetch(`${BASE}/og-kin.png`)).status === 200, [ogI, meta("og:image:width")]);
  check("twitter:card = summary_large_image", meta("twitter:card") === "summary_large_image");
  check("thẻ xem trước không chứa số điện thoại", !ogT.includes("0901234567") && !ogD.includes("0901234567"));

  section("Đo kênh ở điện thoại: chân trang ngoài màn hình thì CHƯA tính xem hết");
  const mctx = await ctxFor(null, { width: 390, height: 420 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${BASE}/mentor/${T.id}?n=bc-t10`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Cô Lan" }).waitFor();
  await eventually("bc-t10: có lượt mở", async () => !!(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "bc-t10", kind: "open" } })));
  await new Promise(r => setTimeout(r, 1200));
  check("chưa kéo xuống cuối: chưa có lượt 'xem hết'", !(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "bc-t10", kind: "full" } })));
  check("trang hồ sơ không tràn ngang trên 390px", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await eventually("kéo xuống cuối → ghi 'xem hết'", async () => !!(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "bc-t10", kind: "full" } })));

  section("Báo cáo hồ sơ (khách)");
  await page.getByRole("button", { name: "Báo cáo hồ sơ này" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  await dlg.getByRole("button", { name: "Gửi báo cáo" }).click();
  check("không chọn lý do → báo lỗi, chưa gửi", await dlg.getByRole("alert").filter({ hasText: "Hãy chọn lý do" }).isVisible() && (await prisma.tutorProfileReport.count()) === 0);
  await dlg.getByRole("radio", { name: "Lý do khác" }).check();
  await dlg.getByRole("button", { name: "Gửi báo cáo" }).click();
  check("'Lý do khác' mà bỏ trống mô tả → báo lỗi", await dlg.getByRole("alert").filter({ hasText: "mô tả ngắn" }).isVisible());
  await dlg.getByRole("radio", { name: "Đòi chuyển khoản trước buổi học thử" }).check();
  await dlg.getByLabel(/Mô tả thêm/).fill("Đòi tôi chuyển 500k trước");
  await dlg.getByRole("button", { name: "Gửi báo cáo" }).click();
  await dlg.getByText(/Đã nhận báo cáo của anh\/chị/).waitFor({ timeout: 15000 });
  const rep = await prisma.tutorProfileReport.findFirst({ where: { tutorId: T.id } });
  check("lưu báo cáo: lý do, mô tả, kênh fb-hn9 (từ ?n=)", rep?.reason === "thu-phi-truoc" && rep.detail === "Đòi tôi chuyển 500k trước" && rep.channel === "fb-hn9", rep);
  await dlg.getByRole("button", { name: "Đóng" }).click();
  await dlg.waitFor({ state: "detached" });
  // báo cáo thêm về gia sư 2 để thử khoá
  await prisma.tutorProfileReport.create({ data: { tutorId: T2.id, reason: "gia-mao", detail: "Lớp không có thật", channel: "fb-hn9" } });
  await prisma.tutorProfileReport.create({ data: { tutorId: T2.id, reason: "thu-phi-truoc" } });

  section("Đăng ký gia sư mở sẵn vai Gia sư");
  const sp = await gctx.newPage(); watch(sp);
  await sp.goto(`${BASE}/dang-ky?vai=gia-su&n=ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.getByText("Thông tin gia sư", { exact: true }).waitFor({ timeout: 60000 });
  check("?vai=gia-su → mở sẵn vai Gia sư (có dòng 'Hồ sơ gia sư sẽ chờ admin duyệt')", await sp.getByText(/Hồ sơ gia sư sẽ chờ admin duyệt/).isVisible());
  const sp2 = await gctx.newPage(); watch(sp2);
  await sp2.goto(`${BASE}/dang-ky`, { waitUntil: "networkidle" });
  await sp2.getByText("Thông tin học sinh", { exact: true }).waitFor({ timeout: 60000 });
  check("không có ?vai → mặc định học sinh (không đổi hành vi cũ)", (await sp2.getByText(/Hồ sơ gia sư sẽ chờ admin duyệt/).count()) === 0);

  section("Bảng phễu (quản trị)");
  const actx = await ctxFor(SA);
  const ap = await actx.newPage(); watch(ap);
  await ap.goto(`${ADMIN}/admin/pheu`, { waitUntil: "networkidle", timeout: 120000 });
  await ap.getByRole("heading", { name: "Bảng phễu gia sư" }).waitFor({ timeout: 90000 });
  check("ghi rõ: không đếm được bài đăng trong nhóm Facebook", await ap.getByText(/không đếm được bài đăng trong nhóm Facebook/).isVisible());
  const tbl = ap.getByRole("table");
  await tbl.waitFor();
  const fbRow = tbl.getByRole("row", { name: /fb-hn9/ });
  check("dòng fb-hn9: Nhóm Facebook, 1 mở, 1 xem hết, 100%", /Nhóm Facebook/.test(await fbRow.innerText()) && (await fbRow.getByRole("cell").allInnerTexts()).join("|").includes("1|1|100%"), await fbRow.innerText());
  const bcRow = tbl.getByRole("row", { name: /bc-t10/ });
  check("dòng bc-t10: Báo cáo chuyển tiếp", /Báo cáo chuyển tiếp/.test(await bcRow.innerText()));
  check("ghi chú: bước đăng ký học thử chưa đo được", await ap.getByText(/chưa có form đăng ký học thử/).isVisible());
  check("hàng chờ 3 báo cáo, hồ sơ khoá 0", await ap.getByRole("heading", { name: /Báo cáo hồ sơ chờ xử lý \(3\) · hồ sơ đang bị khoá: 0/ }).isVisible());
  await shot(ap, "funnel-admin");

  section("Bỏ qua một báo cáo, khoá hồ sơ gia sư khả nghi");
  const itemLan = ap.getByRole("listitem").filter({ hasText: "Cô Lan" });
  await itemLan.getByRole("button", { name: "Bỏ qua" }).click();
  await ap.getByRole("heading", { name: /chờ xử lý \(2\)/ }).waitFor({ timeout: 15000 });
  check("bỏ qua → còn 2, Cô Lan biến khỏi hàng chờ, hồ sơ vẫn công khai", (await ap.getByRole("listitem").filter({ hasText: "Cô Lan" }).count()) === 0 && (await fetch(`${BASE}/api/tutors/${T.id}`)).status === 200);
  const itemKn = ap.getByRole("listitem").filter({ hasText: "Thầy Khả Nghi" }).first();
  check("gia sư bị báo nhiều lần được nêu rõ", await ap.getByText(/gia sư này có 2 báo cáo đang chờ/).first().isVisible());
  await itemKn.getByRole("button", { name: "Khoá hồ sơ" }).click();
  const ld = ap.getByRole("dialog");
  await ld.waitFor();
  check("nút Khoá trong hộp thoại bị khoá tới khi có lý do", await ld.getByRole("button", { name: "Khoá hồ sơ" }).isDisabled());
  await ld.getByLabel("Lý do khoá (bắt buộc)").fill("Hai báo cáo: lớp ảo và đòi chuyển khoản trước");
  await ld.getByRole("button", { name: "Khoá hồ sơ" }).click();
  await ap.getByRole("heading", { name: /chờ xử lý \(0\) · hồ sơ đang bị khoá: 1/ }).waitFor({ timeout: 15000 });
  check("khoá → mọi báo cáo về gia sư đó đóng; đếm hồ sơ khoá = 1", true);
  check("DB: profileLockedAt + lý do", !!(await prisma.user.findUnique({ where: { id: T2.id } }))?.profileLockedAt);

  section("Hồ sơ bị khoá: khách thấy 'Không tìm thấy gia sư'");
  const lp = await gctx.newPage(); watch(lp);
  await lp.goto(`${BASE}/mentor/${T2.id}`, { waitUntil: "networkidle", timeout: 120000 });
  check("trang 404 thân thiện, không lộ tên gia sư", await lp.getByRole("heading", { name: "Không tìm thấy gia sư" }).isVisible() && (await lp.getByText("Thầy Khả Nghi").count()) === 0);

  section("Điện thoại: bảng phễu");
  const mact = await ctxFor(SA, { width: 390, height: 800 });
  const map = await mact.newPage(); watch(map);
  await map.goto(`${ADMIN}/admin/pheu`, { waitUntil: "networkidle", timeout: 120000 });
  await map.getByRole("heading", { name: "Bảng phễu gia sư" }).waitFor({ timeout: 60000 });
  check("không tràn ngang (bảng cuộn trong khung)", await map.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
