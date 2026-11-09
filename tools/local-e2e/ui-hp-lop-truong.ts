// HP-LOP-TRUONG (phần GIAO DIỆN, mục 8 của docs/kin/phong-ban/dac-ta/HP-LOP-TRUONG.md) — TRÌNH DUYỆT thật, 1600px và 390px:
//  · Tạo lớp có lựa chọn "Theo bảng học phí tháng (nhập từ Excel)" trong "Cách tính khác", KHÔNG hỏi đơn giá, DB feeMode = monthly_sheet và không có CourseFeeRate.
//  · Tab Học phí của lớp bảng tháng: bảng bậc, bộ chọn tháng, bảng em, dòng tổng; tải mẫu .xlsx THẬT rồi thả lại chính tệp đó đã điền (setInputFiles).
//  · Dán TSV: xem trước đủ trạng thái (Đúng / Không khớp / Trùng tên / Sai), ô chọn em, nút xác nhận TẮT khi 0 dòng ghi được hoặc còn dòng sai chưa "Bỏ qua".
//  · Panel sửa một em (không hộp thoại): ô Số môn + chữ nguồn số môn, dòng công thức sống do máy chủ tính (dryRun), Phải đóng 0đ, gỡ dòng qua KinConfirm.
//  · Ba trạng thái: tải / lỗi + Thử lại / rỗng (3 loại) + tệp bị từ chối. 390px: không tràn ngang, nút >= 44px, thẻ thay bảng, nút xác nhận dính đáy.
//  · Số tiền viết đủ (không "tr"/"k"), công tắc ẩn tiền che số, trạng thái không chỉ bằng màu.
//  · Gia sư bộ môn / gia sư lớp khác: không thấy tab Học phí, trang con 404, không rò số. Màn buổi của lớp bảng tháng không hứa "sinh học phí khi chốt buổi".
// Dữ liệu dựng bằng prisma trực tiếp (không sửa h.ts / seed*); tên học sinh là tên giả. KHÔNG tự chạy trong lượt viết: COO chạy sau khi máy chủ (tut-code) xong.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-hp-lop-truong.ts     (cỡ máy tính mặc định 1600; thêm DESKTOP_W=1280 để chạy ở laptop; cỡ điện thoại 390 luôn chạy)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";

/** Phần tử bấm cao < 44px (loại thanh bên, cổng Next, toast; ô tích / chọn nằm trong <label> tính theo nhãn). */
const SMALL = `[...document.querySelectorAll('main a, main button, main select, main input, main summary, [role=tab]')].filter(e => {
  const r = e.getBoundingClientRect();
  return e.offsetParent && r.height < 43.5 && e.type !== 'checkbox' && e.type !== 'radio' && e.type !== 'file' && !e.closest('nav') && !e.closest('label') && !e.closest('nextjs-portal') && !e.closest('[data-kin-toast]') && e.getAttribute('aria-label') !== 'Mở rộng thanh bên';
}).map(e => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().height))`;
const NO_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;

const shiftYm = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const i = y * 12 + (m - 1) + by; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const OUT = process.env.SHOTS ?? "scratchpad/shots";
/** Chiều rộng cỡ MÁY TÍNH: mặc định 1600; chạy cỡ laptop: DESKTOP_W=1280 (mọi kiểm tra giữ nguyên, chỉ đổi cỡ cửa sổ). Cỡ điện thoại luôn 390. */
const DW = Number(process.env.DESKTOP_W ?? 1600);

(async () => {
  mkdirSync(OUT, { recursive: true });
  await wipe();
  const today = vnDateKeyOf(new Date());
  const ym = today.slice(0, 7);
  const ymPrev = shiftYm(ym, -1), ymPrev2 = shiftYm(ym, -2), ymPrev3 = shiftYm(ym, -3), ymPrev4 = shiftYm(ym, -4), ymNext = shiftYm(ym, 1);

  const T = await mkTutor("Cô Lan");
  const other = await mkTutor("Cô Khác");
  const sub = await mkTutor("Thầy Bộ Môn");
  const C = await mkCourse(T.id, { name: "Lớp bảng tháng" });
  await prisma.course.update({ where: { id: C.id }, data: { feeMode: "monthly_sheet" } });
  await prisma.courseFeeTable.create({
    data: {
      courseId: C.id, subjects: ["Toán", "Sử", "Địa", "Anh"], updatedBy: T.id, periodStartDay: 1,
      tiers: [{ subjects: 1, rate: 70000 }, { subjects: 2, rate: 60000 }, { subjects: 3, rate: 55000 }, { subjects: 4, rate: 50000 }],
    },
  });
  await prisma.courseTeacher.create({ data: { courseId: C.id, userId: sub.id, role: "subject_teacher", status: "active", invitedBy: T.id, subjects: ["Toán"] } });
  const S: Record<string, { id: string }> = {};
  for (const n of ["Mai Anh", "Bảo Châu", "Minh Khôi", "Gia Hân", "Tuấn Kiệt"]) S[n] = await mkUser({ name: n });
  const hn1 = await mkUser({ name: "Hà Nhi" });
  const hn2 = await mkUser({ name: "Hà Nhi" });
  for (const u of [...Object.values(S), hn1, hn2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });

  await launch();
  const errors: string[] = [];
  const devScriptWarn: string[] = [], notFoundUrls = new Set<string>();
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(`${p.url().replace(BASE, "")} ${String(e)}`));
    p.on("console", m => {
      if (m.type() !== "error" || /Failed to load resource|favicon|net::ERR|status of [45]|AbortError/i.test(m.text())) return;
      // Cảnh báo CÓ SẴN của React bản dev khi một trang gọi notFound() (README, mục 16/10): tách riêng, và cuối bài kiểm nó chỉ đến từ trang 404 do bài CHỦ Ý mở.
      if (/Encountered a script tag while rendering React component/.test(m.text())) { devScriptWarn.push(p.url().replace(BASE, "")); return; }
      errors.push(`${p.url().replace(BASE, "")} ${m.text().slice(0, 140)}`);
    });
  };
  const tabUrl = (id: string, m = ym) => `${BASE}/lop-cua-toi/${id}?tab=hoc-phi&ym=${m}`;
  const nhapUrl = (id: string, m = ym) => `${BASE}/lop-cua-toi/${id}/bang-hoc-phi/nhap?ym=${m}`;
  const bodyText = (p: Page) => p.evaluate("document.body.innerText") as Promise<string>;

  // ───────────────────────── Tạo lớp ─────────────────────────
  section("Tạo lớp: 'Theo bảng học phí tháng' trong Cách tính khác, không hỏi đơn giá");
  const p = await (await ctxFor(T, { width: DW, height: 1000 })).newPage(); watch(p);
  await p.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await p.getByRole("heading", { name: "Tạo lớp học", level: 1 }).waitFor({ timeout: 90000 });
  check("mặc định vẫn là Theo buổi, có ô đơn giá (không đổi hành vi cũ)", await p.getByLabel(/^Theo buổi/).isChecked() && (await p.getByLabel(/^Đơn giá/).count()) >= 1);
  await p.locator("[data-fee-other] summary").click();
  check("trong 'Cách tính khác' có lựa chọn 'Theo bảng học phí tháng (nhập từ Excel)'", await p.getByRole("radio", { name: /Theo bảng học phí tháng \(nhập từ Excel\)/ }).isVisible());
  await p.getByRole("radio", { name: /Theo bảng học phí tháng/ }).check();
  check("chọn bảng tháng → ẩn ô đơn giá, hiện lời giải thích đặt bảng bậc ở tab Học phí", (await p.getByLabel(/^Đơn giá/).count()) === 0 && await p.locator("[data-fee-sheet-note]").isVisible());
  await p.getByLabel(/Tên lớp/).fill("Lớp bảng mới UI");
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  check("không nhập đơn giá vẫn qua được bước 1", await p.locator("[data-wizard-step][aria-current=step]").getAttribute("data-wizard-step") === "2");
  await p.locator("[data-one-off]").click();
  await p.getByRole("button", { name: "Vẫn tạo không lịch" }).click();
  await p.getByRole("button", { name: "Tiếp tục" }).click();
  await p.getByRole("button", { name: "Tạo lớp", exact: true }).click();
  await p.waitForURL(/\/lop-cua-toi\/lop-bang-moi-ui/, { timeout: 90000 });
  const made = await prisma.course.findFirstOrThrow({ where: { ownerId: T.id, name: "Lớp bảng mới UI" } });
  check("DB: feeMode monthly_sheet, KHÔNG có CourseFeeRate", made.feeMode === "monthly_sheet" && (await prisma.courseFeeRate.count({ where: { courseId: made.id } })) === 0, made.feeMode);

  // ───────────────────────── Tab Học phí, 1600px ─────────────────────────
  section(`${DW}px: tab Học phí của lớp bảng tháng`);
  await p.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
  await p.locator("[data-bh-tiers]").waitFor({ timeout: 90000 });
  const tiersText = await p.locator("[data-bh-tiers]").innerText();
  check("tóm tắt bảng bậc: 4 bậc, đủ chữ đồng, và danh sách môn", /1 môn 70\.000đ/.test(tiersText) && /4 môn 50\.000đ/.test(tiersText) && /Toán, Sử, Địa, Anh/.test(tiersText), tiersText);
  check("bộ chọn kỳ có chữ kỳ (tháng dương lịch) và hai nút Tải mẫu / Nhập", /[Tt]háng \d{1,2}\/\d{4}/.test(await p.locator("[data-bh-ky]").innerText()) && await p.getByRole("link", { name: "Tải mẫu Excel" }).isVisible() && await p.getByRole("link", { name: "Nhập từ Excel / Google Sheet" }).isVisible());
  check("bảng có 7 dòng em (5 em + 2 em trùng tên), chưa em nào nhập → 'Chưa nhập'", (await p.locator("[data-bh-tr]").count()) === 7 && (await p.getByText("Chưa nhập").count()) >= 7);
  check("tháng chưa nhập: có lời nhắc 'chưa có học phí'", await p.locator("[data-bh-empty-month]").isVisible());
  check("dòng tổng cố định cuối bảng", await p.locator("[data-bh-total]").isVisible());
  await shot(p, `hp-lt-${DW}-bang-rong`);

  section("Tải mẫu THẬT → điền → thả lại chính tệp đó");
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.getByRole("link", { name: "Tải mẫu Excel" }).click()]);
  check("tải được tệp .xlsx", /\.xlsx$/i.test(dl.suggestedFilename()), dl.suggestedFilename());
  const tpl = join(OUT, "hp-lt-mau.xlsx"), filled = join(OUT, "hp-lt-dien.xlsx");
  await dl.saveAs(tpl);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl);
  const ws = wb.worksheets[0];
  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((c, i) => { col[String(c.value ?? "").trim()] = i; });
  const need = ["Họ tên", "Số môn", "Toán", "Sử", "Địa", "Anh", "Buổi miễn phí", "Đơn giá riêng", "Học bổng", "Giảm trừ"];
  check("mẫu có đủ cột (theo nhãn môn của lớp)", need.every(n => col[n] !== undefined), Object.keys(col));
  ws.spliceRows(2, 1); // bỏ hàng ví dụ (EXAMPLE_MARK)
  const fill: Record<string, Record<string, number>> = {
    "Mai Anh": { Toán: 8, Anh: 4, "Buổi miễn phí": 1, "Học bổng": 50000 },
    "Bảo Châu": { Toán: 8, Sử: 8, Địa: 8, Anh: 8, "Giảm trừ": 100000 },
    "Minh Khôi": { Toán: 8, "Đơn giá riêng": 45000 },
    "Gia Hân": { Toán: 6, Sử: 6, "Số môn": 3 },
    "Tuấn Kiệt": { Anh: 4, "Học bổng": 300000 },
  };
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const f = fill[String(row.getCell(col["Họ tên"]).value ?? "").trim()];
    if (f) for (const [k, v] of Object.entries(f)) row.getCell(col[k]).value = v;
  });
  // Mẫu xuất MỌI em đang học (kể cả hai em "Hà Nhi" trùng tên, để trống). Máy chủ BỎ QUA hàng chỉ có Mã em / Họ tên (không số nào): em đó hiện ở "chưa nhập", KHÔNG thành dòng 0đ.
  // Nên lưu HAI bản: bản giữ nguyên hàng trống (ca kiểm "không xoá hàng trống" bên dưới) và bản cô xoá tay 2 hàng Hà Nhi (luồng chính).
  const filledKeep = join(OUT, "hp-lt-dien-giu-hang-trong.xlsx");
  await wb.xlsx.writeFile(filledKeep);
  const drop: number[] = [];
  ws.eachRow((row, n) => { if (n > 1 && String(row.getCell(col["Họ tên"]).value ?? "").trim() === "Hà Nhi") drop.push(n); });
  for (const n of drop.sort((x, y) => y - x)) ws.spliceRows(n, 1);
  check("mẫu xuất MỌI em đang học (7 hàng, gồm 2 em trùng tên Hà Nhi để trống); cô xoá 2 hàng đó, còn 5 hàng đã điền", drop.length === 2 && ws.actualRowCount === 6, { drop, rows: ws.actualRowCount });
  await wb.xlsx.writeFile(filled);

  await p.getByRole("link", { name: "Nhập từ Excel / Google Sheet" }).click();
  await p.waitForURL(/\/bang-hoc-phi\/nhap\?ym=/, { timeout: 60000 });
  await p.getByRole("heading", { name: "Nhập học phí từ Excel hoặc Google Sheet", level: 1 }).waitFor({ timeout: 90000 });
  check("chưa có gì để xem trước → nút Xem trước tắt", await p.getByRole("button", { name: "Xem trước" }).isDisabled());
  await p.setInputFiles("#bhn-file", filled);
  check("hiện tên tệp đã chọn", await p.locator("[data-bhn-file]").isVisible());
  await p.getByRole("button", { name: "Xem trước" }).click();
  await p.locator("[data-bhn-preview]").waitFor({ timeout: 60000 });
  check("xem trước: 4 dòng Đúng + 1 dòng Cần xem (Phải đóng 0đ), chữ + biểu tượng", (await p.locator("[data-bhn-row=ok]").count()) === 4 && (await p.locator("[data-bhn-row=warn]").count()) === 1 && /✓/.test(await p.locator("[data-bhn-count=ok]").innerText()) && /Đúng/.test(await p.locator("[data-bhn-count=ok]").innerText()));
  const pv = await bodyText(p);
  const rowsTxt = (await p.locator("[data-bhn-row]").allInnerTexts()).join("\n"); // chỉ đếm TRONG các dòng em (chữ giải thích ngoài bảng cũng nhắc cụm này)
  check("MỖI em ghi rõ nguồn Số môn: 1 em 'lấy từ cột Số môn trong tệp', 4 em 'đếm số môn có buổi'", (rowsTxt.match(/lấy từ cột Số môn trong tệp/g) ?? []).length === 1 && (rowsTxt.match(/đếm số môn có buổi/g) ?? []).length === 4, { file: (rowsTxt.match(/lấy từ cột Số môn trong tệp/g) ?? []).length, counted: (rowsTxt.match(/đếm số môn có buổi/g) ?? []).length, trongToanTrang: (pv.match(/đếm số môn có buổi/g) ?? []).length });
  check("chân: 'Sẽ ghi 5 dòng' + Tổng Phải đóng 3.130.000đ (số do máy chủ trả)", /Sẽ ghi 5 dòng/.test(await p.locator("[data-bhn-footer]").innerText()) && /3\.130\.000đ/.test(await p.locator("[data-bhn-footer]").innerText()));
  check("nút xác nhận bật: 'Xác nhận ghi 5 dòng'", await p.getByRole("button", { name: "Xác nhận ghi 5 dòng" }).isEnabled());
  check("xem trước chưa ghi gì", (await prisma.courseFeeSheetRow.count({ where: { courseId: C.id } })) === 0 && (await prisma.feeCharge.count({ where: { courseId: C.id } })) === 0);
  check("số tiền viết đủ: không có '\\d(tr|k)'", !/\d(tr|k)\b/.test(pv));
  await shot(p, `hp-lt-${DW}-xem-truoc`);
  await p.getByRole("button", { name: "Xác nhận ghi 5 dòng" }).click();
  await p.locator("[data-bhn-done]").waitFor({ timeout: 60000 });
  const maiAnh = await prisma.courseFeeSheetRow.findFirstOrThrow({ where: { courseId: C.id, studentId: S["Mai Anh"].id, yearMonth: ym } });
  const giaHan = await prisma.courseFeeSheetRow.findFirstOrThrow({ where: { courseId: C.id, studentId: S["Gia Hân"].id, yearMonth: ym } });
  const tk = await prisma.courseFeeSheetRow.findFirstOrThrow({ where: { courseId: C.id, studentId: S["Tuấn Kiệt"].id, yearMonth: ym } });
  check("DB: đúng số tay tính: Mai Anh 610.000 (đếm môn), Gia Hân 660.000 (số môn 'file'), Tuấn Kiệt 0", maiAnh.net === 610000 && maiAnh.subjectCountSource === "counted" && giaHan.net === 660000 && giaHan.subjectCountSource === "file" && tk.net === 0, { a: maiAnh.net, g: giaHan.net, t: tk.net });
  check("DB: 4 FeeCharge kind sheet (Tuấn Kiệt 0đ không tạo)", (await prisma.feeCharge.count({ where: { courseId: C.id, kind: "sheet" } })) === 4);
  await p.getByRole("link", { name: "Xem bảng học phí" }).click();
  await p.waitForURL(/tab=hoc-phi/, { timeout: 60000 });
  await p.locator("[data-bh-total]").waitFor({ timeout: 60000 });
  check("quay về bảng tháng: dòng tổng 3.130.000đ, Mai Anh 610.000đ", /3\.130\.000đ/.test(await p.locator("[data-bh-total]").innerText()) && /610\.000đ/.test(await p.locator("[data-bh-tr]", { hasText: "Mai Anh" }).innerText()));
  check("em đã nhập chưa lập phiếu → 'Chưa lập phiếu'; Tuấn Kiệt 0đ có chữ 'Không tạo khoản phí'", (await p.getByText("Chưa lập phiếu").count()) >= 4 && await p.locator("[data-bh-tr]", { hasText: "Tuấn Kiệt" }).getByText("Không tạo khoản phí").isVisible());
  await shot(p, `hp-lt-${DW}-bang-da-nhap`);

  // ───────────────────────── Dán TSV ─────────────────────────
  section("Dán TSV: đủ trạng thái, ô chọn em, nút xác nhận");
  await p.goto(nhapUrl(C.id, ymPrev), { waitUntil: "networkidle", timeout: 120000 });
  await p.locator("#bhn-text").waitFor({ timeout: 90000 });
  await p.locator("#bhn-text").fill("Họ tên\tToán\tSử\tĐịa\tAnh\nBảo Châu\t8x\t0\t0\t0");
  await p.getByRole("button", { name: "Xem trước" }).click();
  await p.locator("[data-bhn-preview]").waitFor({ timeout: 60000 });
  check("chỉ có dòng Sai → 0 dòng ghi được → nút xác nhận TẮT, kể cả khi tích Bỏ qua", await p.getByRole("button", { name: /^Xác nhận ghi/ }).isDisabled() && (await p.locator("[data-bhn-row=error]").count()) === 1);
  if (await p.locator("[data-bhn-skip]").count()) await p.locator("[data-bhn-skip]").check();
  check("tích Bỏ qua mà không còn dòng nào ghi được → vẫn tắt, nói lý do", await p.getByRole("button", { name: /^Xác nhận ghi/ }).isDisabled() && /Chưa có dòng nào ghi được/.test(await p.locator("[data-bhn-why]").innerText()));
  await p.locator("#bhn-text").fill("Họ tên\tToán\tSử\tĐịa\tAnh\tBuổi miễn phí\tHọc bổng\nMai Anh\t8\t0\t0\t4\t1\t50000\nEm Lạ\t4\t0\t0\t0\t0\t0\nHà Nhi\t4\t0\t0\t0\t0\t0\nBảo Châu\t8x\t0\t0\t0\t0\t0");
  await p.getByRole("button", { name: "Xem trước" }).click();
  await p.locator("[data-bhn-preview]").waitFor({ timeout: 60000 });
  check("đủ 4 trạng thái: Đúng · Không khớp · Trùng tên · Sai (chữ + biểu tượng)", (await p.locator("[data-bhn-row=ok]").count()) === 1 && (await p.locator("[data-bhn-row=unmatched]").count()) === 1 && (await p.locator("[data-bhn-row=ambiguous]").count()) === 1 && (await p.locator("[data-bhn-row=error]").count()) === 1);
  const chips = await p.locator("[data-bhn-counts]").innerText();
  check("tóm tắt có đủ chữ trạng thái", /Đúng/.test(chips) && /Không khớp/.test(chips) && /Trùng tên/.test(chips) && /Sai/.test(chips), chips);
  check("còn dòng sai + chưa chọn em → nút xác nhận TẮT, có lý do bằng chữ", await p.getByRole("button", { name: /^Xác nhận ghi/ }).isDisabled() && /Còn 3 dòng/.test(await p.locator("[data-bhn-why]").innerText()));
  await p.locator("[data-bhn-pick]").nth(0).selectOption({ label: "Minh Khôi" });
  await p.locator("[data-bhn-pick]").nth(1).selectOption({ index: 1 });
  await eventually("đã chọn em cho hai dòng → còn đúng 1 dòng sai chặn nút (chọn em gọi lại máy chủ nên chờ cập nhật)", async () => await p.getByRole("button", { name: /^Xác nhận ghi/ }).isDisabled() && /Còn 1 dòng/.test(await p.locator("[data-bhn-why]").innerText()), 15000);
  await p.locator("[data-bhn-skip]").check();
  check("tích 'Bỏ qua dòng sai' → bật: 'Xác nhận ghi 3 dòng' (1 đúng + 2 vừa chọn em)", await p.getByRole("button", { name: "Xác nhận ghi 3 dòng" }).isEnabled());
  await shot(p, `hp-lt-${DW}-dan-tsv`);
  await p.getByRole("button", { name: "Xác nhận ghi 3 dòng" }).click();
  await p.locator("[data-bhn-done]").waitFor({ timeout: 60000 });
  const prevRows = await prisma.courseFeeSheetRow.findMany({ where: { courseId: C.id, yearMonth: ymPrev } });
  const ids = prevRows.map(r => r.studentId);
  check("DB: ghi đúng 3 em (Mai Anh, Minh Khôi theo lựa chọn, 1 em Hà Nhi theo lựa chọn); Bảo Châu dòng sai không ghi", prevRows.length === 3 && ids.includes(S["Mai Anh"].id) && ids.includes(S["Minh Khôi"].id) && (ids.includes(hn1.id) || ids.includes(hn2.id)) && !ids.includes(S["Bảo Châu"].id), ids);

  // ───────────────────────── Nạp lại mẫu KHÔNG xoá hàng trống ─────────────────────────
  section("Mẫu giữ nguyên hàng trống: máy chủ bỏ qua hàng chỉ có tên, em trống KHÔNG thành dòng 0đ");
  await p.goto(nhapUrl(C.id, ymPrev4), { waitUntil: "networkidle", timeout: 120000 });
  await p.locator("#bhn-file").waitFor({ timeout: 90000 });
  await p.setInputFiles("#bhn-file", filledKeep);
  await p.getByRole("button", { name: "Xem trước" }).click();
  await p.locator("[data-bhn-preview]").waitFor({ timeout: 60000 });
  check("giữ hàng trống: 'Sẽ ghi 5 dòng' (chỉ các em đã điền), không có dòng 'Trùng tên' từ hai em Hà Nhi trống", /Sẽ ghi 5 dòng/.test(await p.locator("[data-bhn-footer]").innerText()) && (await p.locator("[data-bhn-row=ambiguous]").count()) === 0, await p.locator("[data-bhn-footer]").innerText());
  await p.getByRole("button", { name: "Xác nhận ghi 5 dòng" }).click();
  await p.locator("[data-bhn-done]").waitFor({ timeout: 60000 });
  const keptRows = await prisma.courseFeeSheetRow.findMany({ where: { courseId: C.id, yearMonth: ymPrev4 } });
  const keptIds = keptRows.map(r => r.studentId);
  check("DB: đúng 5 dòng, hai em Hà Nhi (hàng trống) KHÔNG có dòng 0đ", keptRows.length === 5 && !keptIds.includes(hn1.id) && !keptIds.includes(hn2.id), { n: keptRows.length });

  // ───────────────────────── Panel sửa một em ─────────────────────────
  section("Panel sửa một em: dòng công thức sống, Số môn, 0đ, gỡ dòng");
  await p.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
  await p.locator(`[data-bh-row="${S["Mai Anh"].id}"]`).click();
  await p.locator("[data-bh-panel]").waitFor({ timeout: 30000 });
  check("panel nằm cạnh bảng (không phải hộp thoại)", (await p.getByRole("dialog").count()) === 0 && await p.locator("[data-bh-table]").isVisible());
  check("có ô 'Số môn' và chữ nguồn số môn (lần ghi trước: đếm số môn có buổi)", await p.getByLabel("Số môn").isVisible() && /đếm số môn có buổi/.test(await p.locator("[data-bh-nguon-so-mon]").innerText()));
  await p.getByLabel("Toán (buổi)").fill("10");
  await eventually("dòng công thức sống: 13 buổi × 60.000đ = 780.000đ − 50.000đ học bổng = 730.000đ", async () => /13 buổi × 60\.000đ = 780\.000đ − 50\.000đ học bổng = 730\.000đ/.test(await p.locator("[data-bh-cong-thuc]").innerText()), 15000);
  await p.getByLabel(/^Đơn giá riêng/).fill("45000");
  await eventually("đơn giá riêng thắng bậc: 13 buổi × 45.000đ = 585.000đ … = 535.000đ + chữ 'đơn giá riêng của em'", async () => { const t = await p.locator("[data-bh-cong-thuc]").innerText(); return /13 buổi × 45\.000đ = 585\.000đ/.test(t) && /535\.000đ/.test(t) && /đơn giá riêng của em/.test(t); }, 15000);
  check("chưa bấm lưu: DB giữ 610.000 (dryRun không ghi)", (await prisma.courseFeeSheetRow.findFirstOrThrow({ where: { courseId: C.id, studentId: S["Mai Anh"].id, yearMonth: ym } })).net === 610000);
  await shot(p, `hp-lt-${DW}-panel-em`);
  const [saveRes] = await Promise.all([
    p.waitForResponse(r => r.request().method() === "PUT" && /bang-hoc-phi\/dong\//.test(r.url()) && !/"dryRun":true/.test(r.request().postData() ?? ""), { timeout: 30000 }),
    p.getByRole("button", { name: "Lưu học phí" }).click(),
  ]);
  const saveJson = await saveRes.json().catch(() => ({})) as { applied?: boolean };
  check("lưu panel: PUT thật (không dryRun) trả 200 và applied === true", saveRes.status() === 200 && saveJson.applied === true, { status: saveRes.status(), saveJson });
  await p.locator("[data-bh-panel]").waitFor({ state: "detached", timeout: 20000 }); // không nuốt timeout: panel phải đóng sau khi lưu
  const maiNet = (await prisma.courseFeeSheetRow.findFirstOrThrow({ where: { courseId: C.id, studentId: S["Mai Anh"].id, yearMonth: ym } })).net;
  check("lưu xong: DB Mai Anh 535.000 và panel đóng", maiNet === 535000 && (await p.locator("[data-bh-panel]").count()) === 0, { maiNet, panelCount: await p.locator("[data-bh-panel]").count() });
  await p.locator(`[data-bh-row="${S["Tuấn Kiệt"].id}"]`).click();
  await p.locator("[data-bh-panel]").waitFor({ timeout: 30000 });
  await eventually("Phải đóng 0đ: panel nói KiN không tạo khoản phí", async () => /Phải đóng 0đ nên KiN không tạo khoản phí/.test(await p.locator("[data-bh-cong-thuc]").innerText()), 15000);
  await p.getByRole("button", { name: "Gỡ học phí tháng này" }).click();
  check("gỡ dòng hỏi bằng KinConfirm (hộp thoại của KiN), không window.confirm", await p.getByRole("dialog").isVisible());
  await p.getByRole("dialog").getByRole("button", { name: "Gỡ học phí", exact: true }).click();
  await eventually("DB: dòng Tuấn Kiệt đã gỡ", async () => (await prisma.courseFeeSheetRow.count({ where: { courseId: C.id, studentId: S["Tuấn Kiệt"].id, yearMonth: ym } })) === 0, 20000);

  // Em đã rời lớp (còn dòng học phí nhưng hết học): máy chủ từ chối PUT /dong (404), nên giao diện không được mở panel sửa.
  await prisma.enrollment.updateMany({ where: { courseId: C.id, userId: S["Gia Hân"].id }, data: { status: "removed" } });
  await p.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
  const leftTr = p.locator("[data-bh-tr]", { hasText: "Gia Hân" });
  await leftTr.waitFor({ timeout: 60000 });
  check("em đã rời lớp còn dòng chưa vào phiếu: ghi 'Đã rời lớp', tên là nút mở panel CHỈ-GỠ", /Đã rời lớp/.test(await leftTr.innerText()) && (await p.locator(`[data-bh-row="${S["Gia Hân"].id}"]`).count()) === 1);
  await p.locator(`[data-bh-row="${S["Gia Hân"].id}"]`).click();
  await p.locator("[data-bh-panel]").waitFor({ timeout: 30000 });
  check("panel của em đã rời: có chữ 'Em đã rời lớp', KHÔNG có nút Lưu, CÓ nút 'Gỡ học phí tháng này', ô nhập bị khoá", (await p.getByText("Em đã rời lớp", { exact: true }).count()) >= 1 && (await p.getByRole("button", { name: "Lưu học phí" }).count()) === 0 && (await p.getByRole("button", { name: "Gỡ học phí tháng này" }).count()) === 1 && await p.getByLabel("Toán (buổi)").isDisabled());
  await p.getByRole("button", { name: "Huỷ" }).click();
  await prisma.enrollment.updateMany({ where: { courseId: C.id, userId: S["Gia Hân"].id }, data: { status: "active" } });

  // ───────────────────────── Ba trạng thái ─────────────────────────
  section("Ba trạng thái: tải · lỗi + Thử lại · rỗng (3 loại) · tệp bị từ chối");
  const st = await (await ctxFor(T, { width: DW, height: 1000 })).newPage(); watch(st);
  const SHEET_GET = /\/bang-hoc-phi\?ym=/; // GET bảng tháng (không khớp /mau?ym= hay /nhap/*)
  await st.route(SHEET_GET, async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
  await st.goto(tabUrl(C.id), { waitUntil: "domcontentloaded", timeout: 120000 });
  check("tải: khung xương có aria-busy", await st.locator("[data-bh-state=loading][aria-busy=true]").waitFor({ timeout: 30000 }).then(() => true).catch(() => false));
  await st.locator("[data-bh-tiers]").waitFor({ timeout: 60000 });
  await st.unroute(SHEET_GET);
  await st.route(SHEET_GET, r => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Máy chủ đang bận" }) }));
  await st.goto(tabUrl(C.id), { waitUntil: "domcontentloaded", timeout: 120000 });
  await st.locator("[data-bh-state=error]").waitFor({ timeout: 60000 });
  check("lỗi: role=alert + nút 'Thử lại'", (await st.locator("[data-bh-state=error]").getAttribute("role")) === "alert" && await st.getByRole("button", { name: "Thử lại" }).isVisible());
  await st.unroute(SHEET_GET);
  await st.getByRole("button", { name: "Thử lại" }).click();
  check("bấm Thử lại → bảng hiện", await st.locator("[data-bh-tiers]").waitFor({ timeout: 60000 }).then(() => true).catch(() => false));
  await st.goto(tabUrl(C.id, ymNext), { waitUntil: "networkidle", timeout: 120000 });
  check("rỗng #1 (tháng chưa nhập): 'Tháng này chưa có học phí' + hướng dẫn tải mẫu / nhập", await st.locator("[data-bh-empty-month]").waitFor({ timeout: 60000 }).then(() => true).catch(() => false) && /Tải mẫu Excel hoặc nhập từng em/.test(await st.locator("[data-bh-empty-month]").innerText()));
  const C2 = await mkCourse(T.id, { name: "Lớp chưa có bảng bậc" });
  await prisma.course.update({ where: { id: C2.id }, data: { feeMode: "monthly_sheet" } });
  await st.goto(tabUrl(C2.id), { waitUntil: "networkidle", timeout: 120000 });
  await st.locator("[data-bh-state=empty-config]").waitFor({ timeout: 60000 });
  check("rỗng #2 (chưa đặt bảng bậc): 'Cô chưa đặt bảng bậc' + nút 'Đặt bảng bậc'", await st.getByText("Cô chưa đặt bảng bậc").isVisible() && await st.getByRole("button", { name: "Đặt bảng bậc" }).isVisible());
  await st.getByRole("button", { name: "Đặt bảng bậc" }).click();
  await st.locator("[data-bh-cau-hinh]").waitFor({ timeout: 30000 });
  check("panel bảng bậc điền sẵn từ lớp trước của cô (suggestedConfig) và nói rõ", await st.getByText("Điền sẵn từ lớp trước của cô", { exact: true }).isVisible() && (await st.getByLabel("Tên môn 1").inputValue()) === "Toán");
  check("có ô 'Ngày bắt đầu kỳ thu (1–28, mặc định 1 = tháng dương lịch)'", await st.getByLabel(/Ngày bắt đầu kỳ thu \(1–28/).isVisible() && (await st.getByLabel(/Ngày bắt đầu kỳ thu/).inputValue()) === "1");
  await st.getByLabel(/Ngày bắt đầu kỳ thu/).fill("15");
  await st.getByRole("button", { name: "Lưu bảng bậc" }).click();
  await eventually("DB: CourseFeeTable của lớp mới có 4 bậc, ngày bắt đầu kỳ 15", async () => { const t = await prisma.courseFeeTable.findUnique({ where: { courseId: C2.id } }); return !!t && t.periodStartDay === 15 && Array.isArray(t.tiers) && (t.tiers as unknown[]).length === 4; }, 20000);
  await eventually("sau khi lưu: kỳ hiển thị theo máy chủ 'kỳ …(15/…' vì ngày bắt đầu ≠ 1", async () => /kỳ \d{1,2}\/\d{4} \(15\/\d{1,2}/i.test(await st.locator("[data-bh-ky]").innerText()), 20000);
  check("rỗng #3 (lớp chưa có học sinh): 'Lớp chưa có học sinh' + liên kết tab Học sinh", await st.locator("[data-bh-state=empty-students]").isVisible() && await st.getByRole("link", { name: "Mở tab Học sinh" }).isVisible());
  await st.goto(nhapUrl(C.id, ymPrev2), { waitUntil: "networkidle", timeout: 120000 });
  await st.locator("#bhn-file").waitFor({ timeout: 90000 });
  await st.setInputFiles("#bhn-file", { name: "loi.csv", mimeType: "text/csv", buffer: Buffer.from("Cột A,Cột B\n1,2\n") });
  await st.getByRole("button", { name: "Xem trước" }).click();
  await st.locator("[data-bhn-fatal], [data-bhn-fail]").first().waitFor({ timeout: 60000 });
  check("tệp bị từ chối: thẻ lỗi nêu lý do + nút 'Chọn tệp khác', không ghi gì", await st.getByRole("button", { name: "Chọn tệp khác" }).first().isVisible() && (await prisma.courseFeeSheetRow.count({ where: { courseId: C.id, yearMonth: ymPrev2 } })) === 0);
  await shot(st, `hp-lt-${DW}-tep-bi-tu-choi`);
  await st.close();

  // ───────────────────────── Lớp cũ: lời mời bật chế độ ─────────────────────────
  section("Lớp cũ chưa có tiền: có lối bật 'Theo bảng học phí tháng'; lớp đã có tiền thì KHÔNG");
  const old = await mkCourse(T.id, { name: "Lớp cũ chưa tiền" });
  const oldMoney = await mkCourse(T.id, { name: "Lớp cũ đã có tiền" });
  const stuM = await mkUser({ name: "Em Có Phí" });
  await prisma.enrollment.create({ data: { userId: stuM.id, courseId: oldMoney.id, status: "active" } });
  await prisma.feeCharge.create({ data: { tutorId: T.id, courseId: oldMoney.id, studentId: stuM.id, kind: "extra", dateKey: today, yearMonth: ym, amount: 50000, mode: "monthly_sessions", label: "Tài liệu" } });
  const lc = await (await ctxFor(T, { width: DW, height: 1000 })).newPage(); watch(lc);
  await lc.goto(tabUrl(oldMoney.id), { waitUntil: "networkidle", timeout: 120000 });
  await lc.getByRole("heading", { name: "Học phí và đối soát" }).waitFor({ timeout: 90000 });
  await lc.waitForTimeout(2500);
  check("lớp đã có tiền: KHÔNG hiện lối chuyển sang bảng học phí tháng", (await lc.getByRole("button", { name: "Dùng bảng học phí tháng cho lớp này" }).count()) === 0);
  await lc.goto(tabUrl(old.id), { waitUntil: "networkidle", timeout: 120000 });
  await lc.getByRole("button", { name: "Dùng bảng học phí tháng cho lớp này" }).waitFor({ timeout: 60000 });
  await lc.getByRole("button", { name: "Dùng bảng học phí tháng cho lớp này" }).click();
  await lc.locator("[data-bh-cau-hinh]").waitFor({ timeout: 30000 });
  check("form bật chế độ nói rõ chỉ chuyển được khi chưa có học phí và không quay lại", await lc.getByText("Lớp sẽ chuyển sang tính theo bảng học phí tháng").isVisible());
  await lc.getByLabel("Tên môn 1").fill("Toán");
  await lc.getByLabel("Đơn giá của bậc 1").fill("70000");
  await lc.getByRole("button", { name: "Lưu và bật bảng học phí tháng" }).click();
  await eventually("DB: lớp cũ chưa tiền đã thành monthly_sheet kèm CourseFeeTable", async () => { const c = await prisma.course.findUniqueOrThrow({ where: { id: old.id }, select: { feeMode: true } }); return c.feeMode === "monthly_sheet" && !!(await prisma.courseFeeTable.findUnique({ where: { courseId: old.id } })); }, 20000);
  await lc.close();

  // ───────────────────────── Màn buổi + Học phí theo tháng ─────────────────────────
  section("Màn buổi không hứa sinh học phí; Học phí theo tháng gọi đúng tên cách tính");
  await prisma.classSchedule.create({ data: { courseId: C.id, dayOfWeek: dayOfWeekOfKey(today), startTime: "00:05", endTime: "00:35" } });
  const b = await (await ctxFor(T, { width: DW, height: 1000 })).newPage(); watch(b);
  await b.goto(`${BASE}/lop-cua-toi/buoi/${C.id}/${today}`, { waitUntil: "networkidle", timeout: 120000 });
  await b.getByRole("button", { name: "Đã dạy xong" }).waitFor({ timeout: 90000 });
  check("lớp bảng tháng: 'Việc này không tạo hay sửa học phí' (không nói học phí tính lúc Đã dạy xong)", await b.getByText("Việc này không tạo hay sửa học phí").isVisible() && (await b.getByText(/học phí của buổi được tính/).count()) === 0);
  await b.goto(`${BASE}/lop-cua-toi/hoc-phi/thang?ym=${ym}`, { waitUntil: "networkidle", timeout: 120000 });
  await eventually("Học phí theo tháng: lớp bảng tháng có nhãn 'Theo bảng học phí tháng'", async () => /Theo bảng học phí tháng/.test(await bodyText(b)), 30000);
  await b.close();

  // ───────────────────────── Quyền ─────────────────────────
  section("Gia sư bộ môn và gia sư lớp khác: không thấy tab, trang con 404, không rò số");
  for (const [who, u] of [["gia sư bộ môn", sub], ["gia sư lớp khác", other]] as const) {
    const q = await (await ctxFor(u, { width: DW, height: 1000 })).newPage(); watch(q);
    const r1 = await q.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
    await q.waitForTimeout(1500);
    const txt = await bodyText(q);
    check(`${who}: mở ?tab=hoc-phi → không có tab 'Học phí', không rò số/tên học sinh`, (await q.getByRole("tab", { name: "Học phí" }).count()) === 0 && !/3\.130\.000đ|610\.000đ|535\.000đ|Mai Anh|Bảo Châu/.test(txt) && (r1?.status() === 404 || who === "gia sư bộ môn"), { s: r1?.status() });
    const r2 = await q.goto(nhapUrl(C.id), { waitUntil: "domcontentloaded", timeout: 120000 });
    check(`${who}: trang con /bang-hoc-phi/nhap → 404`, r2?.status() === 404, r2?.status());
    const r3 = await q.goto(`${BASE}/lop-cua-toi/${C.id}/bang-hoc-phi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    check(`${who}: /bang-hoc-phi → 404`, r3?.status() === 404, r3?.status());
    const body404 = await bodyText(q);
    for (const [r, u2] of [[r1, tabUrl(C.id)], [r2, nhapUrl(C.id)], [r3, `${BASE}/lop-cua-toi/${C.id}/bang-hoc-phi`]] as const) if (r?.status() === 404) notFoundUrls.add(u2.replace(BASE, ""));
    check(`${who}: trang 404 không chứa số tiền hay tên lớp`, !/\d\.\d{3}đ/.test(body404) && !/Lớp bảng tháng/.test(body404));
    await q.close();
  }

  // ───────────────────────── 390px ─────────────────────────
  section("390px: thẻ thay bảng, panel cả màn, xem trước dạng thẻ, nút xác nhận dính đáy, không tràn, nút >= 44px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  await mctx.addInitScript("try{localStorage.removeItem('kin:an-so-tien')}catch(e){}");
  const m = await mctx.newPage(); watch(m);
  await m.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
  await m.locator("[data-bh-cards]").waitFor({ timeout: 90000 });
  check("390px: mỗi em một THẺ (không bảng), có thẻ tổng", (await m.locator("[data-bh-card]").count()) === 7 && (await m.locator("[data-bh-total-card]").count()) === 1 && (await m.locator("[data-bh-table]").count()) === 0, await m.locator("[data-bh-card]").count());
  const tz = await m.getByRole("link", { name: "Tải mẫu Excel" }).boundingBox(), nh = await m.getByRole("link", { name: "Nhập từ Excel / Google Sheet" }).boundingBox();
  check("390px: nút Tải mẫu và Nhập xếp DỌC, cao >= 44px", !!tz && !!nh && nh.y > tz.y + tz.height - 1 && tz.height >= 43.5 && nh.height >= 43.5, { tz, nh });
  check("390px: không tràn ngang, nút / liên kết >= 44px", (await m.evaluate(NO_OVERFLOW)) === true && ((await m.evaluate(SMALL)) as string[]).length === 0, await m.evaluate(SMALL));
  await shot(m, "hp-lt-390-the");
  await m.locator(`[data-bh-row="${S["Mai Anh"].id}"]`).click();
  await m.locator("[data-bh-panel-full]").waitFor({ timeout: 30000 });
  check("390px: panel sửa em là CẢ MÀN (không hộp thoại), ô số dùng bàn phím số", (await m.getByRole("dialog").count()) === 0 && (await m.locator("[data-bh-panel-full] input[inputmode=numeric]").count()) >= 8 && (await m.locator("[data-bh-table], [data-bh-cards]").count()) === 0);
  check("390px: panel không tràn, ô nhập >= 44px", (await m.evaluate(NO_OVERFLOW)) === true && ((await m.evaluate(SMALL)) as string[]).length === 0, await m.evaluate(SMALL));
  await shot(m, "hp-lt-390-panel");
  await m.getByRole("button", { name: "Huỷ" }).click();
  await m.locator("[data-bh-cards]").waitFor({ timeout: 30000 });

  await m.goto(nhapUrl(C.id, ymPrev3), { waitUntil: "networkidle", timeout: 120000 });
  await m.locator("#bhn-text").waitFor({ timeout: 90000 });
  await m.locator("#bhn-text").fill("Họ tên\tToán\tSử\tĐịa\tAnh\tBuổi miễn phí\tHọc bổng\nMai Anh\t8\t0\t0\t4\t1\t50000\nEm Lạ\t4\t0\t0\t0\t0\t0\nHà Nhi\t4\t0\t0\t0\t0\t0\nBảo Châu\t8x\t0\t0\t0\t0\t0");
  await m.getByRole("button", { name: "Xem trước" }).click();
  await m.locator("[data-bhn-cards]").waitFor({ timeout: 60000 });
  check("390px: xem trước dạng THẺ, mỗi thẻ có nhãn trạng thái bằng chữ ở đầu thẻ", (await m.locator("[data-bhn-card]").count()) === 4 && /Không khớp/.test(await m.locator("[data-bhn-card=unmatched]").innerText()) && /Trùng tên/.test(await m.locator("[data-bhn-card=ambiguous]").innerText()));
  const sel = await m.locator("[data-bhn-pick]").first().evaluate((e: HTMLElement) => e.getBoundingClientRect().height);
  check("390px: ô chọn em (select) cao >= 44px", sel >= 43.5, sel);
  const bar = await m.locator("[data-bhn-bar]").boundingBox();
  check("390px: thanh xác nhận DÍNH ĐÁY (nằm trong khung nhìn khi chưa cuộn tới cuối)", !!bar && bar.y + bar.height <= 844 + 1 && bar.y >= 0, bar);
  check("390px: không tràn ngang, nút / liên kết >= 44px", (await m.evaluate(NO_OVERFLOW)) === true && ((await m.evaluate(SMALL)) as string[]).length === 0, await m.evaluate(SMALL));
  await shot(m, "hp-lt-390-xem-truoc");

  section("Công tắc ẩn tiền che số; số tiền không viết tắt");
  const hide = await (await ctxFor(T, { width: DW, height: 1000 })).newPage(); watch(hide);
  await hide.addInitScript("try{localStorage.setItem('kin:an-so-tien','1')}catch(e){}");
  await hide.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
  await hide.locator("[data-bh-total]").waitFor({ timeout: 90000 });
  const ht = await hide.locator("[data-bh-total]").innerText();
  check("ẩn tiền: dòng tổng và bảng bậc không còn số đồng (chỉ dấu chấm)", (await hide.locator("[data-money-hidden]").count()) > 0 && !/\d\.\d{3}đ/.test(ht) && !/\d\.\d{3}đ/.test(await hide.locator("[data-bh-tiers]").innerText()), ht);
  await hide.close();
  const shown = await (await ctxFor(T, { width: DW, height: 1000 })).newPage(); watch(shown);
  await shown.goto(tabUrl(C.id), { waitUntil: "networkidle", timeout: 120000 });
  await shown.locator("[data-bh-total]").waitFor({ timeout: 90000 });
  check("hiện tiền: không có 'tr'/'k' viết tắt ở đâu trên màn", !/\d(tr|k)\b/.test(await bodyText(shown)));
  await shown.close();

  check("không lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  check("cảnh báo React dev 'script tag' (có sẵn ở trang notFound() của bản dev) chỉ đến từ trang 404 do bài chủ ý mở, không từ trang nào khác", devScriptWarn.every(u => notFoundUrls.has(u)), { devScriptWarn, notFoundUrls: [...notFoundUrls] });
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
