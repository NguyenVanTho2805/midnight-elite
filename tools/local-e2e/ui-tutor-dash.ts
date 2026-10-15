import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, eventually, BASE, cookieFor } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "node:fs";

let seq = 700;
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T0 = await mkTutor("Cô Mới"); // T0: chưa có lớp
  // TT-203: gia sư mới ở chế độ gọn (màn đầu là Lịch). Bài test này kiểm Tổng quan nên bật Hộp việc + Lớp trước.
  const { prisma: pr } = await import("@/lib/prisma");
  for (const u of [T, T0]) await pr.user.update({ where: { id: u.id }, data: { preferences: { modules: ["hop-viec", "lop"] } } });
  const s1 = await mkUser({ name: "Trần Gia Bảo" }), s2 = await mkUser({ name: "Đỗ Hà" }), s3 = await mkUser({ name: "Lê Minh" }), rep = await mkUser({ name: "Người Báo" });
  const c1 = await mkCourse(T.id, { name: "Toán 9", capacity: 2 }), c2 = await mkCourse(T.id, { name: "Lý 9", classStatus: "closed" });
  for (const [u, c] of [[s1, c1], [s2, c1], [s1, c2], [s3, c2]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: (await mkUser({ name: "Chờ PH" })).id, courseId: c1.id, status: "pending_consent" } });
  const YM = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: YM, sessionCount: 8, updatedBy: T.id } });
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Lan" } });
  const key = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json.key;
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: YM, studentIds: [s1.id, s2.id] } });
  const invA = iss.json.created.find((c: any) => c.studentId === s1.id), invB = iss.json.created.find((c: any) => c.studentId === s2.id);
  await api("PATCH", `/api/tutor/invoices/${invA.id}`, { as: T, body: { action: "send" } });          // B giữ nháp
  await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, transferType: "in", transferAmount: invA.amountDue, content: invA.code, code: invA.code } }); // đúng số tiền phiếu → tự gạch
  await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, transferType: "in", transferAmount: 12345, content: "khong ma" } });                      // chờ đối soát
  // báo cáo cộng đồng + bài chưa chấm
  const th = await prisma.thread.create({ data: { content: "Nội dung vi phạm trong lớp Toán 9. ".repeat(3), authorId: s2.id, courseId: c1.id } });
  const th2 = await prisma.thread.create({ data: { content: "Bài bị báo cáo oan", authorId: s3.id, courseId: c1.id } });
  await prisma.threadReport.create({ data: { threadId: th.id, reporterId: rep.id, reason: "Spam quảng cáo" } });
  await prisma.threadReport.create({ data: { threadId: th2.id, reporterId: rep.id, reason: "Không phù hợp" } });
  const sec = await prisma.section.create({ data: { id: `sec-${Date.now()}`, title: "Chương 1", courseId: c1.id } });
  const chap = await prisma.chapter.create({ data: { id: `chap-${Date.now()}`, title: "Bài 1", sectionId: sec.id } });
  const les = await prisma.lesson.create({ data: { id: `les-${Date.now()}`, code: "L1", title: "Bài học 1", type: "record", chapterId: chap.id } });
  const asg = await prisma.assignment.create({ data: { lessonId: les.id, title: "BTVN 1", ownerId: T.id, mode: "file" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: s1.id, fileUrl: "x" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: s2.id, fileUrl: "y", score: 8, gradedAt: new Date() } }); // đã chấm, không tính
  const asg2 = await prisma.assignment.create({ data: { lessonId: les.id, title: "Tự luận", ownerId: T.id, mode: "interactive", dueDate: new Date(Date.now() + 86400000) } });
  const q = await prisma.assignmentQuestion.create({ data: { assignmentId: asg2.id, order: 1, text: "Giải thích…", type: "ESSAY" } });
  await prisma.assignmentAnswer.create({ data: { questionId: q.id, userId: s1.id, textAnswer: "Bài làm" } });
  await prisma.assignmentAnswer.create({ data: { questionId: q.id, userId: s2.id, textAnswer: "Đã chấm", pointsAwarded: 1 } });

  await launch();
  const ctx = await ctxFor(T);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/favicon|font|Failed to load resource|vietqr/i.test(m.text())) errors.push(m.text()); });

  section("Tổng quan gia sư /lop-cua-toi/tong-quan");
  await page.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Lớp của tôi" }).waitFor({ timeout: 90000 });
  const dd = (label: string) => page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]").innerText();
  const PAID = invA.amountDue.toLocaleString("vi-VN"); // số tiền đã gạch của phiếu A
  check("Học viên đang học = 3 (s1,s2,s3 — không đếm trùng s1 ở 2 lớp, không đếm 'chờ PH')", (await dd("Học viên đang học")) === "3", await dd("Học viên đang học"));
  check("Lớp đang dạy = 1/2 (1 lớp mở trên tổng 2)", (await dd("Lớp đang dạy")) === "1/2", await dd("Lớp đang dạy"));
  check("Đã thu tháng này = số tiền phiếu A đã gạch", (await dd("Đã thu tháng này")).includes(PAID), [await dd("Đã thu tháng này"), PAID]);
  const todoText = await page.locator("#h-viec").locator("xpath=..").innerText();
  check("việc: 1 khoản chờ đối soát", /Khoản tiền vào cần đối soát\s*\n?\s*1/.test(todoText), todoText);
  check("việc: 1 yêu cầu xác nhận phụ huynh", /Yêu cầu xác nhận của phụ huynh đang chờ\s*\n?\s*1/.test(todoText), todoText);
  check("việc: 2 báo cáo cộng đồng", /Báo cáo cộng đồng trong lớp của bạn\s*\n?\s*2/.test(todoText), todoText);
  check("việc: 2 bài chưa chấm (1 nộp file + 1 tự luận; bài đã chấm không tính)", /chưa chấm\s*\n?\s*2/.test(todoText), todoText);
  check("việc: 1 phiếu nháp chưa gửi", /Phiếu học phí nháp chưa gửi\s*\n?\s*1/.test(todoText), todoText);
  check("việc khẩn (đối soát) đứng đầu danh sách", todoText.indexOf("Khoản tiền vào cần đối soát") < todoText.indexOf("Báo cáo cộng đồng"));
  check("thẻ lớp Toán 9: 2/2 học viên, đã đầy", await page.getByText("2/2").first().isVisible() && await page.getByText(/đã đầy/).isVisible());
  check("thẻ lớp Lý 9: trạng thái 'Đã đóng'", await page.getByText(/Lý 9/).first().isVisible() && await page.getByText(/Đã đóng/).first().isVisible());
  check("thẻ có nút Điểm danh / Danh sách HS / Mở lớp", (await page.getByRole("link", { name: "Điểm danh" }).count()) === 2);
  await shot(page, "dash-tutor");
  await page.getByRole("navigation", { name: "Lối tắt" }).getByRole("link", { name: "Học phí", exact: true }).click();
  await page.waitForURL(/hoc-phi/);
  check("lối tắt Học phí hoạt động", true);

  section("Trạng thái rỗng + CTA");
  const p0 = await (await ctxFor(T0)).newPage();
  await p0.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle" });
  await p0.getByText("Bạn chưa mở lớp nào").waitFor({ timeout: 60000 });
  check("có CTA 'Tạo lớp đầu tiên'", await p0.getByRole("link", { name: "Tạo lớp đầu tiên" }).isVisible());
  check("không có việc → thông báo", await p0.getByText("Hiện không có việc nào cần xử lý.").isVisible());
  check("mọi số liệu = 0", (await p0.locator("dd").first().innerText()) === "0");

  section("Doanh thu /lop-cua-toi/doanh-thu");
  await page.goto(`${BASE}/lop-cua-toi/doanh-thu`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Doanh thu của tôi" }).waitFor({ timeout: 60000 });
  await eventually("thẻ Đã thu = tiền phiếu A", () => page.getByText(`${PAID}đ`).first().isVisible());
  check("bảng theo lớp có Toán 9", await page.getByRole("table").getByText("Toán 9").isVisible());
  check("danh sách khoản đã thu có tên em + mã phiếu", await page.getByText(invA.code).first().isVisible());
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Xuất CSV/ }).click()]);
  const csv = readFileSync((await dl.path())!, "utf8");
  check("CSV tải được, có dòng Trần Gia Bảo + số tiền", csv.includes("Trần Gia Bảo") && csv.includes(`,${invA.amountDue}`), csv.slice(0, 300));
  await page.getByLabel("Từ ngày").fill("2030-01-01");
  await page.getByLabel("Đến ngày").fill("2030-01-31");
  await eventually("khoảng tương lai → 'Chưa thu khoản nào'", () => page.getByText("Chưa thu khoản nào trong khoảng này.").first().isVisible());
  await page.getByLabel("Đến ngày").fill("2029-01-01");
  await page.getByText("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.").waitFor();
  check("khoảng ngày đảo ngược → cảnh báo, không gọi API", true);

  section("Hồ sơ gia sư");
  await page.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Hồ sơ gia sư" }).waitFor({ timeout: 60000 });
  check("gia sư đã duyệt: 'Đã xác minh' + link hồ sơ công khai", await page.getByText("Đã xác minh").first().isVisible() && await page.getByRole("link", { name: "Xem hồ sơ công khai" }).isVisible());
  await page.locator("#bio").fill("Dạy Toán 10 năm. Đỗ chuyên Toán.");
  await page.getByLabel("Thêm môn dạy").fill("Toán");
  await page.getByLabel("Thêm môn dạy").press("Enter");
  await page.getByRole("button", { name: "+ Vật lý" }).click();
  await page.getByLabel("Thêm môn dạy").fill("toán"); await page.getByLabel("Thêm môn dạy").press("Enter"); // trùng không phân biệt hoa thường
  check("thêm môn: 'Toán' + 'Vật lý', trùng 'toán' bị bỏ", (await page.getByRole("list", { name: "Môn đã chọn" }).locator("li").count()) === 2);
  await page.getByRole("button", { name: "Bỏ môn Vật lý" }).click();
  await page.getByRole("button", { name: "+ Hoá học" }).click();
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await page.getByText("Đã lưu hồ sơ.").waitFor({ timeout: 20000 });
  const dbU = await prisma.user.findUnique({ where: { id: T.id } });
  check("DB: bio + môn [Toán, Hoá học]", dbU?.bio === "Dạy Toán 10 năm. Đỗ chuyên Toán." && dbU.subjects.join() === "Toán,Hoá học", dbU);
  await page.getByRole("button", { name: "Bỏ môn Toán" }).click(); await page.getByRole("button", { name: "Bỏ môn Hoá học" }).click();
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await page.getByText("Chọn ít nhất 1 môn dạy").waitFor({ timeout: 10000 });
  check("không cho lưu khi 0 môn", true);
  // ảnh đại diện (png 1x1 hợp lệ)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator("#avatar-file").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: png });
  await page.getByText("Đã cập nhật ảnh đại diện.").waitFor({ timeout: 20000 });
  check("đổi ảnh đại diện → DB lưu data:image/jpeg", ((await prisma.user.findUnique({ where: { id: T.id }, select: { avatarBase64: true } }))?.avatarBase64 ?? "").startsWith("data:image/jpeg"));
  // người đang chờ duyệt (role student + đã nộp đơn)
  const pend = await mkUser({ name: "Ứng Viên" });
  await prisma.user.update({ where: { id: pend.id }, data: { tutorAppliedAt: new Date(), bio: "Mới ra trường", subjects: ["Toán"] } });
  const pp = await (await ctxFor(pend)).newPage();
  await pp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle" });
  await pp.getByText("Hồ sơ đang chờ duyệt.").waitFor({ timeout: 60000 });
  check("người chờ duyệt thấy banner 'Hồ sơ đang chờ duyệt… tính năng bị giới hạn'", await pp.getByText(/Một số tính năng bị giới hạn/).isVisible());
  await prisma.user.update({ where: { id: pend.id }, data: { tutorRejectedAt: new Date(), tutorRejectReason: "Thiếu kinh nghiệm" } });
  await pp.reload({ waitUntil: "networkidle" });
  await pp.getByText("Hồ sơ chưa được duyệt.").waitFor({ timeout: 60000 });
  check("bị từ chối: hiện lý do", await pp.getByText(/Thiếu kinh nghiệm/).isVisible());
  const stu = await (await ctxFor(s3)).newPage();
  await stu.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle" });
  check("học viên thường vào trang hồ sơ gia sư → chuyển về /lop-cua-toi", stu.url().endsWith("/lop-cua-toi"), stu.url());

  section("Kiểm duyệt cộng đồng lớp");
  await page.goto(`${BASE}/lop-cua-toi/kiem-duyet`, { waitUntil: "networkidle" });
  await page.getByText("Spam quảng cáo").waitFor({ timeout: 60000 });
  check("thấy 2 báo cáo của lớp mình (kèm tên lớp, tác giả, người báo)", (await page.locator("li", { hasText: "Lớp Toán 9" }).count()) === 2 && await page.getByText("Người Báo").first().isVisible());
  await page.locator("li", { hasText: "Không phù hợp" }).getByRole("button", { name: "Bỏ qua" }).click();
  await page.getByText("Đã bỏ qua báo cáo.").waitFor({ timeout: 20000 });
  check("bỏ qua → bài giữ nguyên", (await prisma.thread.findUnique({ where: { id: th2.id } }))?.deletedAt === null && (await prisma.threadReport.findFirst({ where: { threadId: th2.id } }))?.status === "rejected");
  await page.locator("li", { hasText: "Spam quảng cáo" }).getByRole("button", { name: "Xoá bài vi phạm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xoá bài" }).click();
  await page.getByText("Đã xoá bài viết vi phạm.").waitFor({ timeout: 20000 });
  check("xoá bài vi phạm → soft-delete (giữ bằng chứng)", (await prisma.thread.findUnique({ where: { id: th.id } }))?.deletedAt !== null);
  await eventually("hết báo cáo → trạng thái rỗng", () => page.getByText("Không có báo cáo nào cần xử lý.").isVisible());
  const outsider = await (await ctxFor(s1)).newPage();
  await outsider.goto(`${BASE}/lop-cua-toi/kiem-duyet`, { waitUntil: "networkidle" });
  check("học viên không vào được trang kiểm duyệt", outsider.url().endsWith("/lop-cua-toi"), outsider.url());

  section("Hộp việc của lớp: Mã mời");
  await page.goto(`${BASE}/lop-cua-toi/${c1.id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Mã mời/ }).first().click();
  await page.getByText("Tạo mã mời mới").waitFor({ timeout: 60000 });
  await eventually("chưa có mã → thông báo", () => page.getByText("Chưa có mã mời nào.").isVisible());
  await page.getByLabel(/Số lượt dùng tối đa/).fill("2");
  await page.getByLabel(/Hiệu lực/).fill("7");
  await page.getByRole("button", { name: "Tạo mã mời" }).click();
  await page.getByText(/Đã tạo mã/).waitFor({ timeout: 20000 });
  const inv = await prisma.classInvite.findFirst({ where: { courseId: c1.id } });
  check("DB: mã 8 ký tự, maxUses 2, hết hạn ~7 ngày", inv?.code.length === 8 && inv.maxUses === 2 && Math.abs((inv.expiresAt!.getTime() - Date.now()) - 7 * 86400000) < 3600000, inv);
  await eventually("danh sách hiện mã + 'Đang dùng được' + 0/2 lượt", async () => (await page.getByText(inv!.code).isVisible()) && (await page.getByText("Đang dùng được").isVisible()) && (await page.getByText(/Đã dùng 0\/2 lượt/).isVisible()));
  await page.getByRole("button", { name: "Sao chép link" }).click();
  await page.getByText("Đã sao chép link mời.").waitFor({ timeout: 10000 });
  const link = await page.evaluate(() => navigator.clipboard.readText());
  check("link mời = /student/nhap-ma-lop?code=<mã>", link.endsWith(`/student/nhap-ma-lop?code=${inv!.code}`), link);
  await shot(page, "dash-invites");
  // học viên mở link → mã điền sẵn
  const sp = await (await ctxFor(rep)).newPage();
  await sp.goto(link, { waitUntil: "networkidle" });
  await eventually("trang nhập mã tự điền sẵn từ ?code=", async () => (await sp.locator("input").first().inputValue()) === inv!.code);
  await sp.getByText(/Toán 9/).first().waitFor({ timeout: 20000 });
  check("preview hiện lớp Toán 9 từ mã trong link", true);
  await page.getByRole("button", { name: "Thu hồi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Thu hồi" }).click();
  await page.getByText(/Đã thu hồi mã/).waitFor({ timeout: 20000 });
  await eventually("mã chuyển 'Đã thu hồi', hết nút", async () => (await page.getByText("Đã thu hồi", { exact: true }).isVisible()) && (await page.getByRole("button", { name: "Thu hồi" }).count()) === 0);
  check("DB: revoked", (await prisma.classInvite.findFirst({ where: { courseId: c1.id } }))?.revoked === true);
  check("hộp việc có mục 'Cộng đồng lớp' dẫn tới kiểm duyệt", await page.getByRole("button", { name: /Cộng đồng lớp/ }).first().isVisible());

  section("Mobile 390");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage();
  for (const path of ["/lop-cua-toi", "/lop-cua-toi/tong-quan", "/lop-cua-toi/doanh-thu", "/lop-cua-toi/ho-so", "/lop-cua-toi/kiem-duyet", `/lop-cua-toi/${c1.id}`]) {
    await mp.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await mp.waitForTimeout(800);
    check(`${path}: không tràn ngang`, !(await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  }
  await mp.goto(`${BASE}/lop-cua-toi/tong-quan`, { waitUntil: "networkidle" });
  await shot(mp, "dash-tutor-mobile");

  check("không lỗi console/pageerror", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
