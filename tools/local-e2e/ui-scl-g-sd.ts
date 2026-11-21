// SCL-G-SD (21/11/2026) — sổ điểm gia sư theo bản chốt (QUYET-DINH-GIAO-DIEN §2.3, §3.5; Figma 732:2) trên trình duyệt thật, 1280 và 390:
// bảng thường (không role=grid) có caption + vùng cuộn có nhãn + th scope; đầu cột tên đầy đủ + "Hạn dd/mm" + "/10"; ô điểm đậm "8,0"; ô chưa điểm = hình + chữ
// (có "Quá hạn"); cột "Trung bình"; cột tên dính khi cuộn ngang; chip lọc button aria-pressed ≥ 44px có số; MỘT nút chính "Chấm N bài đang chờ" mở lần lượt,
// có "Bài tiếp", lưu xong tự mở bài kế; "Xuất CSV" có BOM, không lộ id; 390 không tràn ngang. Phần thuần (soDiem.ts) kiểm trước, không cần máy chủ.
// Chạy (máy chủ dev đang chạy): source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-scl-g-sd.ts  (SHOTS_DIR=… để chụp ảnh)
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { cellQueue, csvCell, fmtDiem, gradebookCsvMatrix, queueAfter, rowAverage, rowHas, shownState, soDiemBack, toCsv, type Cell, type Column } from "@/lib/soDiem";

const SHOTS = process.env.SHOTS_DIR;
// Chờ 400ms cho hộp thoại hiện xong (mờ dần 180ms) rồi mới chụp.
const snap = async (pg: Page, name: string) => { if (SHOTS) { await pg.waitForTimeout(400); await pg.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const PRIMARY = "bg-[var(--kin-nhan-nen)]";

function pure() {
  section("Phần thuần (soDiem.ts)");
  const cols: Column[] = [
    { id: "a", kind: "bai-tap", title: "A", max: 10, dueAt: "2020-01-01T00:00:00.000Z", dueLabel: "Hạn 01/01" },
    { id: "b", kind: "azota", title: "B", max: 20 },
  ];
  const c = (state: Cell["state"], score: number | null = null, max: number | null = null): Cell => ({ state, label: "", score, max });
  check("fmtDiem: 8 → 8,0; 8.5 → 8,5; 8.25 → 8,25", fmtDiem(8) === "8,0" && fmtDiem(8.5) === "8,5" && fmtDiem(8.25) === "8,25");
  check("chưa nộp + quá hạn ⇒ 'qua-han'; chưa có hạn ⇒ giữ 'chua-nop'", shownState(c("chua-nop"), cols[0], new Date()) === "qua-han" && shownState(c("chua-nop"), cols[1], new Date()) === "chua-nop");
  check("Trung bình thang 10, bỏ Chờ duyệt: 8/10 và 15/20 ⇒ 7,8", rowAverage({ a: c("da-cham", 8, 10), b: c("da-cham", 15, 20) }, cols) === 7.8 && rowAverage({ a: c("cho-duyet", 9, 10) }, cols) === null);
  check("lọc theo hàng", rowHas({ a: c("cho-cham") }, "cho-cham") && !rowHas({ a: c("cho-cham") }, "chua-nop") && rowHas({}, "tat-ca"));
  const q = cellQueue([{ studentId: "s1", cells: { a: { ...c("cho-cham"), submissionId: "x" }, b: { ...c("cho-duyet", 5, 20), resultId: "r" } } }, { studentId: "s2", cells: { a: c("cho-cham") } }], cols);
  check("hàng đợi Chờ chấm chỉ gồm bài nộp chấm được ngay (quiz giữ điểm không có mã bài nộp)", q.join() === "s1~a", q);
  const rs = [{ studentId: "s1" }, { studentId: "s2" }, { studentId: "s3" }];
  check("queueAfter: bài kế theo cột rồi hàng; bài vừa chấm (đã rời hàng đợi) vẫn tính vị trí; hết thì quay về đầu; chỉ còn chính nó ⇒ null",
    queueAfter(["s1~a", "s3~a", "s2~b"], "s1~a", rs, cols) === "s3~a" && queueAfter(["s3~a", "s2~b"], "s1~a", rs, cols) === "s3~a"
    && queueAfter(["s1~a", "s2~b"], "s2~b", rs, cols) === "s1~a" && queueAfter(["s1~a"], "s1~a", rs, cols) === null);
  check("CSV: ô mở đầu bằng = được thêm ' (chặn công thức), ngoặc kép nhân đôi, có BOM", csvCell("=HYPERLINK(1)") === `"'=HYPERLINK(1)"` && csvCell('a"b') === '"a""b"' && toCsv([["x"]]).charCodeAt(0) === 0xfeff);
  check("soDiemBack: không mo ⇒ như cũ; lỗi điểm ⇒ mở lại ô; xong ⇒ tiep=1; mo rác bị bỏ",
    soDiemBack("L", "da-cham", null) === "/lop-cua-toi/so-diem?lop=L&ghi=da-cham" && soDiemBack("L", "diem-sai", "s1~a") === "/lop-cua-toi/so-diem?lop=L&ghi=diem-sai&mo=s1~a"
    && soDiemBack("L", "da-cham", "s1~a").endsWith("&tiep=1") && soDiemBack("L", "da-cham", "x&y=1~a") === "/lop-cua-toi/so-diem?lop=L&ghi=da-cham");
  const m = gradebookCsvMatrix(cols, [{ name: "Em A", cells: { a: c("da-cham", 8, 10), b: c("cho-duyet", 15, 20) } }], new Date());
  check("CSV: đầu cột có hạn + thang, ô Chờ duyệt ghi rõ, Trung bình không tính Chờ duyệt", m[0].join("|") === "Học sinh|A · Hạn 01/01 · /10|B · /20|Trung bình /10" && m[1].join("|") === "Em A|8,0|Chờ duyệt · 15,0|8,0", m);
}

(async () => {
  pure();
  await wipe();
  const T = await mkTutor("Cô Lan (thử)");
  const names = ["Nguyễn Minh Anh (thử)", "Trần Bảo (thử)", "Lê Gia Huy (thử)", "Phạm Thu Trang Ngọc Diệp (thử)"];
  const S = await Promise.all(names.map(name => mkUser({ name })));
  const c1 = await mkCourse(T.id, { name: "Toán 9 · Lớp thử A" });
  for (const s of S) await prisma.enrollment.create({ data: { userId: s.id, courseId: c1.id, status: "active" } });
  const giao = async (title: string, dueDate: string) => {
    const r = await api("POST", "/api/tutor/bai-tap/giao", { as: T, body: { kind: "bai-tap", courseId: c1.id, title, dueDate } });
    if (r.status !== 200) throw new Error(`giao ${title}: ${r.status}`);
    return prisma.assignment.findFirstOrThrow({ where: { title } });
  };
  const b3 = await giao("Bài tập buổi 3: phương trình bậc hai", "2026-11-10");
  const b4 = await giao("Bài tập buổi 4", "2030-11-24");
  const b5 = await giao("Bài tập buổi 5: hệ thức Vi-ét và ứng dụng", "2030-11-30");
  const sub = (a: { id: string }, u: { id: string }, score: number | null = null) => prisma.assignmentSubmission.create({ data: { assignmentId: a.id, userId: u.id, fileUrl: "https://example.com/bai-lam", kind: "link", score } });
  await sub(b3, S[0], 8); await sub(b3, S[1], 7.5); await sub(b3, S[2], 9.5);            // S[3] chưa nộp buổi 3 (đã quá hạn) ⇒ "Quá hạn"
  await sub(b5, S[0], 9);
  for (const [b, s] of [[b4, S[0]], [b4, S[1]], [b5, S[1]], [b4, S[2]], [b5, S[2]]] as const) await sub(b, s); // 5 bài chờ chấm; S[3] chưa nộp gì
  await prisma.exam.create({ data: { id: "az-gsd", code: "AZGSD", title: "Kiểm tra 15 phút chương 1", category: "toan", date: "12/11/2026", time: "08:00", duration: "15 phút", questions: 0, status: "available", createdAt: "2026-11-21", azotaUrl: "https://azota.vn/x", totalPoints: 10, courseId: c1.id, ownerId: T.id } });
  await prisma.examResult.create({ data: { userId: S[1].id, examId: "az-gsd", score: 7.5, totalPoints: 10, pendingReview: true } });
  const pending = await prisma.assignmentSubmission.count({ where: { score: null, assignment: { id: { in: [b3.id, b4.id, b5.id] } } } });

  await launch();
  const errors: string[] = [];
  const URL0 = `${BASE}/lop-cua-toi/so-diem?lop=${c1.id}`;

  section("Gia sư 1280 — cấu trúc màn");
  const ctx = await ctxFor(T, { width: 1280, height: 900 });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => errors.push(String(e)));
  await pg.goto(URL0, { waitUntil: "networkidle", timeout: 170000 });
  const table = pg.locator("[data-so-diem]:visible table");
  await table.waitFor({ timeout: 90000 });
  check("bảng thường: không role=grid, có caption, vùng cuộn có nhãn 'Sổ điểm, cuộn ngang'",
    (await pg.locator("[role=grid]:visible").count()) === 0 && (await table.locator("caption").count()) === 1
    && (await pg.locator("[data-so-diem]:visible").getAttribute("aria-label")) === "Sổ điểm, cuộn ngang");
  check("mọi ô đầu có scope (col/row)", await table.evaluate(t => [...t.querySelectorAll("th")].every(th => th.getAttribute("scope") === "col" || th.getAttribute("scope") === "row")));
  const h3 = (await pg.getByRole("columnheader", { name: /Bài tập buổi 3/ }).innerText()).replace(/\s+/g, " ");
  check("đầu cột: tên bài ĐẦY ĐỦ + 'Hạn 10/11' + '/10'", h3.includes("Bài tập buổi 3: phương trình bậc hai") && h3.includes("Hạn 10/11") && / \/10$/.test(h3), h3);
  check("đầu cột đề: 'Ngày 12/11'", (await pg.getByRole("columnheader", { name: /Kiểm tra 15 phút/ }).innerText()).includes("Ngày 12/11"));
  check("cột 'Trung bình' ghi đủ chữ (không 'TB')", (await pg.getByRole("columnheader", { name: /^Trung bình/ }).count()) === 1);
  check("câu 'Bấm một ô để mở bài nộp'", await pg.getByText("Bấm một ô để mở bài nộp").isVisible());
  check("dòng giải thích 'Chờ duyệt'", (await pg.locator("[data-so-diem-giai-thich]:visible").innerText()).startsWith("Chờ duyệt:"));
  const diem = pg.locator("[data-so-diem]:visible a[data-o-mo]", { hasText: /^8,0$/ }).first();
  check("ô điểm in đậm '8,0'", await diem.evaluate(a => parseInt(getComputedStyle(a.querySelector("span")!).fontWeight) >= 700));
  const statusCells = await pg.evaluate(() => [...document.querySelectorAll("[data-so-diem] td [data-kin-status]")].filter(e => (e as HTMLElement).offsetParent).map(e => ({ t: (e as HTMLElement).innerText.trim(), svg: !!e.querySelector("svg[data-kin-hinh]") })));
  check("ô chưa có điểm: luôn có HÌNH + CHỮ", statusCells.length > 0 && statusCells.every(s => s.svg && s.t.length > 0), statusCells);
  check("có 'Quá hạn', 'Chờ chấm', 'Chờ duyệt · 7,5', 'Chưa nộp'", ["Quá hạn", "Chờ chấm", "Chờ duyệt · 7,5", "Chưa nộp"].every(t => statusCells.some(s => s.t === t)), statusCells.map(s => s.t));
  check("Trung bình Nguyễn Minh Anh = 8,5 (8 và 9)", (await pg.locator("[data-so-diem-hang]:visible", { hasText: "Nguyễn Minh Anh" }).locator("[data-so-diem-tb]").innerText()).trim() === "8,5");
  const chips = await pg.locator("[data-so-diem-loc]:visible button").evaluateAll(bs => bs.map(b => ({ t: (b as HTMLElement).innerText.trim(), p: b.getAttribute("aria-pressed"), h: b.getBoundingClientRect().height })));
  check("4 chip lọc Chờ chấm/Chờ duyệt/Chưa nộp/Tất cả, có số, aria-pressed, ≥ 44px; 'Tất cả' đang bật",
    chips.length === 4 && /^Chờ chấm \d+$/.test(chips[0].t) && /^Chờ duyệt 1$/.test(chips[1].t) && /^Chưa nộp \d+$/.test(chips[2].t) && chips[3].t === "Tất cả 4"
    && chips.every(c => c.h >= 44 && (c.p === "true" || c.p === "false")) && chips[3].p === "true", chips);
  const primaries = await pg.evaluate(cls => [...document.querySelectorAll("a, button")].filter(e => (e as HTMLElement).offsetParent && !e.hasAttribute("data-kin-skip") && e.className.includes(cls)) /* liên kết "Bỏ qua tới nội dung" (G0) chỉ hiện khi có tiêu điểm */.map(e => (e as HTMLElement).innerText.trim()), PRIMARY);
  check(`MỘT nút chính duy nhất: 'Chấm ${pending} bài đang chờ'`, primaries.length === 1 && primaries[0] === `Chấm ${pending} bài đang chờ`, primaries);
  const csvBtn = pg.locator("[data-so-diem-csv]:visible");
  check("'Xuất CSV' là nút phụ", (await csvBtn.count()) === 1 && !(await csvBtn.getAttribute("class"))!.includes(PRIMARY));
  const small = await pg.evaluate(() => [...document.querySelectorAll("main a, main button")].filter(e => { const r = e.getBoundingClientRect(); return (e as HTMLElement).offsetParent && r.width > 0 && r.height < 44; }).map(e => (e as HTMLElement).innerText.trim()));
  check("mọi nút / ô bấm trong trang ≥ 44px", small.length === 0, small);
  await snap(pg, "so-diem-1280");

  section("CSV");
  const csv = await pg.request.get(`${BASE}/api/tutor/so-diem?courseId=${c1.id}&format=csv`);
  const body = await csv.text();
  check("CSV: 200, text/csv, BOM UTF-8, có tên + điểm '8,0', không lộ id học sinh/bài nộp",
    csv.status() === 200 && (csv.headers()["content-type"] ?? "").startsWith("text/csv") && body.charCodeAt(0) === 0xfeff && body.includes("Nguyễn Minh Anh") && body.includes('"8,0"') && !body.includes(S[0].id) && !body.includes("example.com"), body.slice(0, 200));
  const stu = await (await ctxFor(S[0], { width: 390, height: 844 })).request.get(`${BASE}/api/tutor/so-diem?courseId=${c1.id}&format=csv`);
  check("học sinh tải CSV → 403", stu.status() === 403, stu.status());

  section("Chip lọc");
  await pg.locator("[data-so-diem-loc]:visible button[data-loc=cho-duyet]").click();
  await pg.waitForURL(/loc=cho-duyet/, { timeout: 60000 });
  await pg.locator("[data-so-diem-loc]:visible button[data-loc=cho-duyet][aria-pressed=true]").waitFor({ timeout: 60000 });
  const shownRows = await pg.locator("[data-so-diem-hang]:visible").allInnerTexts();
  check("lọc 'Chờ duyệt' ⇒ chỉ hàng Trần Bảo, chip bật aria-pressed=true", shownRows.length === 1 && shownRows[0].includes("Trần Bảo"), shownRows.length);

  section("Chấm lần lượt");
  await pg.goto(URL0, { waitUntil: "networkidle", timeout: 120000 });
  await pg.locator("[data-so-diem-cham-loat]:visible").click();
  const dlg = pg.getByRole("dialog");
  await dlg.waitFor({ timeout: 60000 });
  check("nút chính mở hộp bài nộp (role=dialog, aria-modal, có tiêu đề), có 'Bài tiếp' và ô điểm 16px tự có tiêu điểm",
    (await dlg.getAttribute("aria-modal")) === "true" && !!(await dlg.getAttribute("aria-labelledby")) && (await dlg.locator("[data-so-diem-bai-tiep]").count()) === 1
    && (await dlg.locator("[data-cham] input[name=score]").evaluate(el => document.activeElement === el)));
  await snap(pg, "so-diem-1280-hop");
  const first = await dlg.locator("h2").innerText();
  await dlg.locator("[data-so-diem-bai-tiep]").click();
  await pg.waitForFunction(t => document.querySelector("[role=dialog] h2")?.textContent !== t, first, { timeout: 60000 });
  check("'Bài tiếp' sang bài chờ chấm khác", (await pg.getByRole("dialog").locator("h2").innerText()) !== first);
  await pg.keyboard.press("Escape");
  await pg.getByRole("dialog").waitFor({ state: "detached", timeout: 30000 });
  check("Escape đóng hộp, bỏ ?mo khỏi địa chỉ", !pg.url().includes("mo="));
  await pg.locator("[data-so-diem-cham-loat]:visible").click();
  for (let i = 0; i < pending; i++) {
    const d = pg.getByRole("dialog");
    await d.locator("[data-cham] input[name=score]").waitFor({ timeout: 60000 });
    const title = await d.locator("h2").innerText();
    await d.locator("[data-cham] input[name=score]").fill(i === 0 ? "11" : "8,5");
    await d.locator("[data-cham] button[type=submit]").click();
    if (i === 0) {
      await pg.waitForURL(/ghi=diem-sai/, { timeout: 60000 });
      check("điểm sai ⇒ hộp mở lại ĐÚNG bài đó, kèm lời báo", (await pg.getByRole("dialog").locator("h2").innerText()) === title && await pg.locator("[data-so-diem-ghi='diem-sai']:visible").isVisible());
      await pg.getByRole("dialog").locator("[data-cham] input[name=score]").fill("8,5");
      await pg.getByRole("dialog").locator("[data-cham] button[type=submit]").click();
    }
    await pg.waitForURL(/ghi=da-cham/, { timeout: 60000 });
    if (i < pending - 1) {
      await pg.waitForFunction(t => { const h = document.querySelector("[role=dialog] h2")?.textContent; return !!h && h !== t; }, title, { timeout: 60000 });
    }
  }
  await pg.locator("[data-so-diem-ghi='da-cham']:visible").waitFor({ timeout: 60000 });
  const left = await prisma.assignmentSubmission.count({ where: { score: null, assignment: { id: { in: [b3.id, b4.id, b5.id] } } } });
  check(`lưu xong tự mở bài kế; hết ${pending} bài ⇒ hộp đóng, không còn nút 'Chấm N bài'`, left === 0 && (await pg.getByRole("dialog").count()) === 0 && (await pg.locator("[data-so-diem-cham-loat]:visible").count()) === 0, left);

  section("Ô Chờ duyệt mở hộp duyệt (luồng đợt 2 giữ nguyên)");
  await pg.locator("[data-so-diem]:visible a[data-o-mo]", { hasText: "Chờ duyệt · 7,5" }).click();
  const dd = pg.getByRole("dialog");
  await dd.locator("[data-duyet]").waitFor({ timeout: 60000 });
  check("hộp có Duyệt / Sửa điểm / Từ chối", (await dd.locator("[data-duyet-ok] button[value=duyet]").count()) === 1 && (await dd.locator("[data-duyet-sua]").count()) === 1 && (await dd.locator("[data-tu-choi]").count()) === 1);
  await dd.locator("[data-tu-choi]").click();
  const conf = pg.locator("[data-kin-confirm]");
  await conf.waitFor({ timeout: 30000 });
  await conf.getByRole("button", { name: "Huỷ" }).click();
  check("Từ chối ⇒ KinConfirm; Huỷ ⇒ còn hộp, điểm vẫn chờ duyệt", (await pg.getByRole("dialog").count()) >= 1 && (await prisma.examResult.findFirst({ where: { examId: "az-gsd" } }))?.pendingReview === true);
  await pg.getByRole("dialog").locator("[data-duyet-ok] button[value=duyet]").click();
  await pg.waitForURL(/ghi=da-duyet/, { timeout: 60000 });
  check("Duyệt ⇒ điểm vào sổ, hộp đóng (không còn điểm chờ duyệt)", (await prisma.examResult.findFirst({ where: { examId: "az-gsd" } }))?.pendingReview === false);
  await ctx.close();

  section("Gia sư 390 — điện thoại");
  await prisma.assignmentSubmission.updateMany({ where: { assignmentId: b4.id }, data: { score: null } });
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const m = await mctx.newPage();
  m.on("pageerror", e => errors.push(String(e)));
  await m.goto(URL0, { waitUntil: "networkidle", timeout: 170000 });
  const region = m.locator("[data-so-diem]:visible");
  await region.waitFor({ timeout: 90000 });
  check("390: trang không tràn ngang", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check("390: bảng cuộn ngang trong khung", await region.evaluate(r => r.scrollWidth > r.clientWidth));
  await region.evaluate(r => { r.scrollLeft = 300; });
  const stick = await region.evaluate(r => { const th = r.querySelector("tbody th")!; return { pos: getComputedStyle(th).position, d: Math.abs(th.getBoundingClientRect().left - r.getBoundingClientRect().left) }; });
  check("390: cột tên dính (position: sticky) khi cuộn ngang", stick.pos === "sticky" && stick.d <= 2, stick);
  const chipTops = await m.locator("[data-so-diem-loc]:visible button").evaluateAll(bs => new Set(bs.map(b => Math.round(b.getBoundingClientRect().top))).size);
  check("390: chip lọc xuống dòng, không tràn", chipTops >= 2 && await m.locator("[data-so-diem-loc]:visible").evaluate(f => f.scrollWidth <= f.clientWidth + 1), chipTops);
  const pb = await m.locator("[data-so-diem-cham-loat]:visible").evaluate(e => e.getBoundingClientRect().height);
  check("390: nút chính ≥ 48px", pb >= 48, pb);
  await region.evaluate(r => { r.scrollLeft = 0; });
  await snap(m, "so-diem-390");
  await m.locator("[data-so-diem-cham-loat]:visible").click();
  const md = m.getByRole("dialog");
  await md.locator("[data-cham] input[name=score]").waitFor({ timeout: 60000 });
  const fs = await md.locator("[data-cham] input[name=score]").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  check("390: hộp là tờ dưới, ô điểm 16px, không tràn ngang", fs >= 16 && await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), fs);
  await snap(m, "so-diem-390-hop");
  await mctx.close();

  check("không lỗi trang", errors.length === 0, errors);
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll(); process.exit(1); });
