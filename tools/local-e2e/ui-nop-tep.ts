// BU-HS-NOP-TEP mục 8 (ui-nop-tep): khối nộp tệp Word/PDF ở tab "Bài tập" của trang bài giảng học sinh + khung trả bài của gia sư. Chụp 1280 và 390.
// Cần máy chủ test cổng 3100 (driver local: máy dev tự bật). stu-dev viết theo đặc tả; CHƯA CHẠY (stu-test chạy).
// Móc dữ liệu: [data-nop-tep=student|tutor_return][data-trang-thai], [data-nop-tep-vung-tha] (nút vùng thả), [data-nop-tep-input], [data-nop-tep-chon],
// [data-nop-tep-hang][data-trang-thai=dang-tai|kiem-tra|san-sang|loi|da-nop|het-han|da-tra], [data-nop-tep-loi], [data-nop-tep-bo], [data-nop-tep-thu-lai],
// [data-nop-tep-nop], [data-nop-tep-nop-lai], [data-nop-tep-huy], [data-nop-tep-da-nop], [data-nop-tep-han], [data-nop-tep-het-han], [data-nop-tep-tai],
// [data-nop-tep-canh-bao], [data-nop-tep-chua-bat], [data-nop-tep-loi-tai], [data-nop-tep-ket-qua=<mã ?nop>], [data-nop-tep-ds=…] (tệp học sinh nộp, phía gia sư).
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

// ── Tệp thật dựng bằng tay: docx = zip "stored" có [Content_Types].xml + word/document.xml; pdf = đầu %PDF + %%EOF ────────
const CRC = (() => { const t: number[] = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function docx(tag = ""): Buffer {
  const entries: [string, Buffer][] = [
    ["[Content_Types].xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)],
    ["word/document.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Bai lam ${tag}</w:t></w:r></w:p></w:body></w:document>`)],
  ];
  const locals: Buffer[] = [], centrals: Buffer[] = []; let off = 0;
  for (const [name, data] of entries) {
    const nm = Buffer.from(name), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, data); centrals.push(ch, nm); off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
const pdf = () => Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const png = () => Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const f = (name: string, buffer: Buffer, mimeType = DOCX_MIME) => ({ name, mimeType, buffer });

const VN = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
const vnDate = (d: Date) => VN.format(d); // "dd/mm/yyyy"
const id = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const EXPIRED_TEXT = "Tệp đã được xoá sau 60 ngày; điểm và nhận xét vẫn giữ.";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const S2 = await mkUser({ name: "Em Bình" });   // dùng cho ca "tính năng tắt" (giả bằng chặn route)
  const SX = await mkUser({ name: "Em Nghỉ Lớp" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  for (const [u, status] of [[S, "active"], [S2, "active"], [SX, "suspended"]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status } });
  const sec = await prisma.section.create({ data: { id: id("sec"), title: "Phần 1", order: 1, courseId: C.id } });
  const ch = await prisma.chapter.create({ data: { id: id("ch"), title: "Chương 1", order: 1, sectionId: sec.id } });
  const L = await prisma.lesson.create({ data: { id: id("les"), code: "B1", title: "Bài tập về nhà", type: "document", order: 1, chapterId: ch.id, isLocked: false, status: "published", documents: "[]", azotaUrl: "https://azota.vn/de/abc123" } });
  const A = await prisma.assignment.create({ data: { lessonId: L.id, title: "BT nộp tệp", mode: "file", ownerId: T.id, dueDate: new Date(Date.now() + 7 * 86_400_000) } });
  const lessonUrl = `${BASE}/student/bai-giang/${L.id}`;

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)/i.test(m.text())) errors.push(m.text()); }); };
  const hide = async (p: any) => p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });
  const BOX = '[data-nop-tep="student"]';
  const open = async (p: any, url = lessonUrl) => {
    await p.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    await hide(p);
    await p.getByRole("button", { name: "Bài tập" }).first().click();
    await p.locator(BOX).waitFor({ timeout: 60000 });
  };
  const settled = async (p: any) => p.locator(`${BOX}:not([data-trang-thai="dang-tai"])`).waitFor({ timeout: 30000 });
  const countInit = (p: any) => { const c = { n: 0 }; p.on("request", (r: any) => { if (r.url().includes("/api/media/nop-bai/init")) c.n++; }); return c; };
  const rows = (p: any) => p.locator(`${BOX} [data-nop-tep-hang]`);

  // ─────────────────────────────────────────────────────────────────────────
  section("1280px: ba trạng thái của khối (đang tải / trống / lỗi tải danh sách)");
  const c1 = await ctxFor(S, { width: 1280, height: 900 });
  const p1 = await c1.newPage(); watch(p1);
  check("thanh bên có nhãn vai học sinh (.kin-rail-role)", await (async () => { await p1.goto(lessonUrl, { waitUntil: "networkidle", timeout: 120000 }); return /học sinh/i.test(((await p1.locator("#kin-rail .kin-rail-role").first().textContent().catch(() => "")) ?? "").trim()); })());

  // đang tải: giữ phản hồi danh sách 1,5 giây
  let release: () => void = () => {};
  const hold = new Promise<void>(r => { release = r; });
  await p1.route("**/api/media/nop-bai/danh-sach**", async r => { await hold; await r.continue(); });
  await hide(p1);
  await p1.getByRole("button", { name: "Bài tập" }).first().click();
  await p1.locator(BOX).waitFor({ timeout: 60000 });
  check("đang tải: khung xương, aria-busy, data-trang-thai=dang-tai", (await p1.locator(`${BOX}[data-trang-thai="dang-tai"] [aria-busy="true"]`).count()) === 1);
  await shot(p1, "nop-tep-1280-dang-tai");
  release(); await p1.unroute("**/api/media/nop-bai/danh-sach**"); await settled(p1);

  // lỗi tải danh sách: 500, có "Thử lại"; bấm thì tải lại được
  await p1.route("**/api/media/nop-bai/danh-sach**", r => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await p1.reload({ waitUntil: "networkidle" }); await hide(p1);
  await p1.getByRole("button", { name: "Bài tập" }).first().click();
  await p1.locator('[data-nop-tep-loi-tai]').waitFor({ timeout: 30000 });
  check("lỗi tải: role=alert + chữ rõ + nút Thử lại ≥44px", (await p1.locator('[data-nop-tep-loi-tai]').getAttribute("role")) === "alert" && /Không tải được khối nộp bài/.test((await p1.locator('[data-nop-tep-loi-tai]').textContent()) ?? "")
    && (((await p1.locator('[data-nop-tep-loi-tai]').getByRole("button", { name: "Thử lại" }).boundingBox())?.height ?? 0) >= 44));
  await shot(p1, "nop-tep-1280-loi-tai");
  await p1.unroute("**/api/media/nop-bai/danh-sach**");
  await p1.locator('[data-nop-tep-loi-tai]').getByRole("button", { name: "Thử lại" }).click();
  await settled(p1);

  section("trống: vùng thả, chú thích, cảnh báo, Nộp bài tắt");
  check("data-trang-thai=trong", (await p1.locator(BOX).getAttribute("data-trang-thai")) === "trong");
  const zone = p1.locator(`${BOX} [data-nop-tep-vung-tha]`);
  check("vùng thả là <button> thật, cao ≥160px ở 1280", (await zone.evaluate(e => e.tagName)) === "BUTTON" && (((await zone.boundingBox())?.height ?? 0) >= 160));
  const cap = (await p1.locator(`${BOX} [data-nop-tep-chu-thich]`).textContent()) ?? "";
  check("chú thích: Word hoặc PDF, dưới 10 MB, không nhận ảnh/video, lưu 60 ngày", /Word hoặc PDF, dưới 10 MB\. Không nhận ảnh hay video\. Tệp được lưu 60 ngày rồi tự xoá\./.test(cap), cap);
  check("khối cảnh báo thông tin cá nhân hiện", await p1.locator(`${BOX} [data-nop-tep-canh-bao]`).isVisible());
  check("'Nộp bài' tắt + chữ lý do 'Chọn ít nhất 1 tệp.'", await p1.locator(`${BOX} [data-nop-tep-nop]`).isDisabled() && /Chọn ít nhất 1 tệp\./.test((await p1.locator(`${BOX} [data-nop-tep-tom-tat]`).textContent()) ?? ""));
  check("còn đường nộp bằng link Azota ở phía trên (AzotaPanel không đổi)", (await p1.getByText(/azota/i).count()) > 0);
  await shot(p1, "nop-tep-1280-trong");

  // ─────────────────────────────────────────────────────────────────────────
  section("lỗi tại chỗ, KHÔNG gọi mạng tới init: ảnh, 11 MB, đuôi lạ, .doc");
  const init = countInit(p1);
  const input = p1.locator(`${BOX} [data-nop-tep-input]`);
  await input.setInputFiles(f("anh.png", png(), "image/png"));
  await rows(p1).first().waitFor();
  check("thả .png ⇒ hàng lỗi 'KiN không nhận ảnh…', có Bỏ tệp, KHÔNG có Thử lại", /KiN không nhận ảnh làm bài/.test((await p1.locator(`${BOX} [data-nop-tep-loi]`).first().textContent()) ?? "")
    && (await rows(p1).first().getAttribute("data-trang-thai")) === "loi" && (await p1.locator(`${BOX} [data-nop-tep-bo]`).count()) === 1 && (await p1.locator(`${BOX} [data-nop-tep-thu-lai]`).count()) === 0);
  await p1.locator(`${BOX} [data-nop-tep-bo]`).click();
  await input.setInputFiles(f("to.pdf", Buffer.alloc(11 * 1024 * 1024, 1), "application/pdf"));
  await rows(p1).first().waitFor();
  check("tệp 11 MB ⇒ 'Tệp lớn hơn 10 MB…'", /Tệp lớn hơn 10 MB/.test((await p1.locator(`${BOX} [data-nop-tep-loi]`).first().textContent()) ?? ""));
  await p1.locator(`${BOX} [data-nop-tep-bo]`).click();
  await input.setInputFiles(f("bai.zip", Buffer.from("PK"), "application/zip"));
  await rows(p1).first().waitFor();
  check("đuôi .zip ⇒ lỗi, không gọi init", (await rows(p1).first().getAttribute("data-trang-thai")) === "loi" && init.n === 0, init.n);
  await p1.locator(`${BOX} [data-nop-tep-bo]`).click();
  await input.setInputFiles(f("bai-cu.doc", Buffer.from("x"), "application/msword"));
  await rows(p1).first().waitFor();
  check("đuôi .doc ⇒ gợi ý lưu lại thành .docx", /\.docx/.test((await p1.locator(`${BOX} [data-nop-tep-loi]`).first().textContent()) ?? ""));
  await shot(p1, "nop-tep-1280-loi-tep");
  await p1.locator(`${BOX} [data-nop-tep-bo]`).click();
  check("tổng cộng KHÔNG có yêu cầu nào tới /nop-bai/init cho cả bốn tệp sai", init.n === 0, init.n);

  // ─────────────────────────────────────────────────────────────────────────
  section("thả 1 .docx thật: tiến độ rồi 'sẵn sàng'");
  let releasePut: () => void = () => {};
  const putHold = new Promise<void>(r => { releasePut = r; });
  await p1.route("**/api/media/nop-bai/dai/**", async r => { await putHold; await r.continue(); });
  await input.setInputFiles(f("Bai lam Toan.docx", docx("a")));
  await p1.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="dang-tai"]`).waitFor({ timeout: 30000 });
  check("đang tải: có role=progressbar và aria-busy trên khối", (await p1.locator(`${BOX} [role="progressbar"]`).count()) === 1 && (await p1.locator(BOX).getAttribute("aria-busy")) === "true");
  check("đang tải: 'Nộp bài' vẫn tắt", await p1.locator(`${BOX} [data-nop-tep-nop]`).isDisabled());
  await shot(p1, "nop-tep-1280-dang-tai-len");
  releasePut(); await p1.unroute("**/api/media/nop-bai/dai/**");
  await eventually("hàng chuyển sang san-sang + chữ 'Đã kiểm tra, sẵn sàng'", async () => (await rows(p1).first().getAttribute("data-trang-thai")) === "san-sang" && /Đã kiểm tra, sẵn sàng/.test((await rows(p1).first().textContent()) ?? ""), 30000);
  check("'Nộp bài' bật khi có ≥1 tệp sẵn sàng", await p1.locator(`${BOX} [data-nop-tep-nop]`).isEnabled());
  check("trong DB: 1 tệp ready, chưa gắn bài nộp, hạn = createdAt + 60 ngày",
    await (async () => { const r = await prisma.submissionFile.findMany({ where: { assignmentId: A.id, studentUserId: S.id } }); return r.length === 1 && r[0].status === "ready" && r[0].submissionId === null && Math.abs(r[0].expiresAt.getTime() - r[0].createdAt.getTime() - 60 * 86_400_000) < 1000; })());

  section("4 tệp một lượt: nhận 3, báo tối đa 3");
  await input.setInputFiles([f("b.docx", docx("b")), f("c.pdf", pdf(), "application/pdf"), f("d.docx", docx("d"))]);
  await eventually("tổng 3 tệp sẵn sàng + 1 hàng lỗi 'tối đa 3 tệp'", async () => (await p1.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="san-sang"]`).count()) === 3 && /tối đa 3 tệp/.test((await p1.locator(`${BOX} [data-nop-tep-loi]`).allTextContents()).join(" ")), 30000);
  await p1.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="loi"] [data-nop-tep-bo]`).click();
  await p1.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="san-sang"]`).last().locator("[data-nop-tep-bo]").click();
  await eventually("bỏ 1 tệp: còn 2, máy chủ đã xoá (xoa)", async () => (await p1.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="san-sang"]`).count()) === 2 && (await prisma.submissionFile.count({ where: { assignmentId: A.id, studentUserId: S.id, status: "ready", submissionId: null } })) === 2, 20000);

  // ─────────────────────────────────────────────────────────────────────────
  section("Nộp bài: bấm đúp ⇒ đúng một bài nộp; trạng thái 'Đã nộp'");
  const nopResp = p1.waitForResponse(r => /\/api\/student\/nop-bai\/[^/]+\/nop/.test(r.url()) && r.request().method() === "POST", { timeout: 60000 });
  await p1.locator(`${BOX} [data-nop-tep-nop]`).dblclick();
  await nopResp;
  await p1.locator(`${BOX}[data-trang-thai="da-nop"]`).waitFor({ timeout: 60000 });
  const subs = await prisma.assignmentSubmission.findMany({ where: { assignmentId: A.id, userId: S.id } });
  check("đúng 1 AssignmentSubmission, kind 'tep', fileUrl là đường riêng tư /api/media/nop-bai/…", subs.length === 1 && subs[0].kind === "tep" && subs[0].fileUrl.startsWith("/api/media/nop-bai/"), subs.map(s => [s.kind, s.fileUrl]));
  check("tệp gắn vào bài nộp một lần (2 tệp ready đã gắn)", (await prisma.submissionFile.count({ where: { submissionId: subs[0].id, status: "ready" } })) === 2);
  check("sau 303: tab Bài tập tự mở + banner kết quả 'Đã nộp bài.' (role=status)", (await p1.locator('[data-nop-tep-ket-qua="ok"]').getAttribute("role")) === "status" && /Đã nộp bài\./.test((await p1.locator('[data-nop-tep-ket-qua="ok"]').textContent()) ?? ""));
  check("địa chỉ đã bỏ ?nop (tải lại không báo lại)", !p1.url().includes("nop="), p1.url());
  const filesDb = await prisma.submissionFile.findMany({ where: { submissionId: subs[0].id }, orderBy: { createdAt: "asc" } });
  const sentence = (await p1.locator(`${BOX} [data-nop-tep-da-nop]`).textContent()) ?? "";
  check("'Đã nộp lúc hh:mm ngày dd/mm/yyyy' (mốc từ máy chủ)", /Đã nộp lúc \d\d:\d\d ngày \d\d\/\d\d\/\d{4}\./.test(sentence), sentence);
  check("mỗi tệp ghi 'Hết hạn tải sau <ngày hết hạn của MÁY CHỦ>'", (await p1.locator(`${BOX} [data-nop-tep-han]`).allTextContents()).every(t => filesDb.some(r => t.includes(`Hết hạn tải sau ${vnDate(r.expiresAt)}`))));
  const dl = p1.locator(`${BOX} [data-nop-tep-tai]`);
  check("có nút 'Tải xuống' ≥44px trỏ về /api/media/nop-bai/<id> (không lộ địa chỉ kho)", (await dl.count()) >= 2 && (await dl.first().getAttribute("href"))?.startsWith("/api/media/nop-bai/") === true && ((await dl.first().boundingBox())?.height ?? 0) >= 44
    && !/cloudinary/i.test(await p1.locator(BOX).innerHTML()));
  check("nút 'Nộp lại bài' (viền) hiện", await p1.locator(`${BOX} [data-nop-tep-nop-lai]`).isVisible());
  check("chưa chấm: 'Gia sư sẽ chấm và nhận xét.'", /Gia sư sẽ chấm và nhận xét\./.test(sentence + ((await p1.locator(BOX).textContent()) ?? "")));
  await shot(p1, "nop-tep-1280-da-nop");

  section("hết hạn: đúng câu, không còn nút tải, điểm và nhận xét vẫn hiện");
  await prisma.assignmentSubmission.update({ where: { id: subs[0].id }, data: { score: 8, comment: "Làm tốt", gradedAt: new Date(), gradedBy: T.id } });
  await prisma.submissionFile.updateMany({ where: { submissionId: subs[0].id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await open(p1); await settled(p1);
  check("data-trang-thai=het-han + câu 'Tệp đã được xoá sau 60 ngày; điểm và nhận xét vẫn giữ.'", (await p1.locator(BOX).getAttribute("data-trang-thai")) === "het-han" && (await p1.locator(`${BOX} [data-nop-tep-het-han]`).textContent())?.trim() === EXPIRED_TEXT);
  check("không còn nút tải", (await p1.locator(`${BOX} [data-nop-tep-tai]`).count()) === 0);
  check("điểm và nhận xét vẫn hiện (ngoài khối)", /Điểm: 8/.test((await p1.locator(`[data-bai-tap-the="${A.id}"]`).textContent()) ?? "") && /Làm tốt/.test((await p1.locator(`[data-bai-tap-the="${A.id}"]`).textContent()) ?? ""));
  await shot(p1, "nop-tep-1280-het-han");
  await prisma.submissionFile.updateMany({ where: { submissionId: subs[0].id }, data: { expiresAt: new Date(Date.now() + 59 * 86_400_000) } });
  await prisma.assignmentSubmission.update({ where: { id: subs[0].id }, data: { score: null, comment: null, gradedAt: null, gradedBy: null } });

  // ─────────────────────────────────────────────────────────────────────────
  section("gia sư: danh sách tệp học sinh + khung trả bài (ghép trong BaiTap.tsx)");
  const cT = await ctxFor(T, { width: 1280, height: 900 });
  const pT = await cT.newPage(); watch(pT);
  await pT.goto(`${BASE}/lop-cua-toi/bai-tap`, { waitUntil: "networkidle", timeout: 120000 }); await hide(pT);
  check("thanh bên có nhãn vai gia sư (.kin-rail-role)", /gia sư/i.test(((await pT.locator("#kin-rail .kin-rail-role").first().textContent().catch(() => "")) ?? "").trim()));
  await pT.getByText("BT nộp tệp").first().click();
  await pT.locator('[data-nop-tep-ds="co-tep"]').waitFor({ timeout: 60000 });
  const tDl = pT.locator('[data-nop-tep-ds="co-tep"] [data-nop-tep-tai]');
  check("gia sư thấy danh sách tệp học sinh nộp, mỗi tệp có 'Tải xuống' ≥44px; không còn 'Mở bài nộp gốc'", (await tDl.count()) === 2 && ((await tDl.first().boundingBox())?.height ?? 0) >= 44 && (await pT.getByText("Mở bài nộp gốc").count()) === 0);
  check("nhắc bật chế độ xem bảo vệ của Word", /Protected View|xem bảo vệ/.test((await pT.locator('[data-nop-tep-ds="co-tep"]').textContent()) ?? ""));
  const tBox = pT.locator('[data-nop-tep="tutor_return"]');
  await tBox.waitFor({ timeout: 30000 });
  check("khung 'Tệp trả bài (tuỳ chọn)' hiện với vùng thả nhỏ", /Tệp trả bài \(tuỳ chọn\)/.test((await tBox.textContent()) ?? "") && (await tBox.locator("[data-nop-tep-vung-tha]").count()) === 1);
  const tInit = countInit(pT);
  await tBox.locator("[data-nop-tep-input]").setInputFiles(f("phan-hoi.png", png(), "image/png"));
  check("tệp trả bài sai loại ⇒ lỗi tại chỗ, không gọi init", /KiN không nhận ảnh/.test((await tBox.locator("[data-nop-tep-loi]").first().textContent()) ?? "") && tInit.n === 0);
  await tBox.locator("[data-nop-tep-bo]").click();
  await tBox.locator("[data-nop-tep-input]").setInputFiles(f("nhan-xet.docx", docx("tra")));
  await tBox.locator('[data-nop-tep-hang][data-trang-thai="san-sang"]').waitFor({ timeout: 30000 });
  await shot(pT, "nop-tep-1280-gia-su");
  await pT.locator("#bt-score").fill("9");
  await pT.locator("#bt-comment").fill("Em làm tốt, xem tệp đính kèm.");
  await pT.getByRole("button", { name: "Gửi điểm & phản hồi" }).click();
  await eventually("'Gửi điểm & phản hồi' gọi grade rồi dinh-kem: điểm lưu + tệp trả gắn vào bài nộp", async () => {
    const s = await prisma.assignmentSubmission.findUnique({ where: { id: subs[0].id } });
    return s?.score === 9 && (await prisma.submissionFile.count({ where: { submissionId: subs[0].id, kind: "tutor_return", status: "ready" } })) === 1;
  }, 30000);
  check("thông báo thành công, không báo lỗi đính kèm", /Đã gửi điểm và phản hồi cho học sinh\./.test((await pT.locator("[role=status]").allTextContents()).join(" ")));
  check("học sinh nhận thông báo 'Gia sư đã trả bài' đúng một dòng, không có tên/tên tệp", await (async () => { const n = await prisma.notification.findMany({ where: { userId: S.id, type: "submission_returned" } }); return n.length === 1 && !/nhan-xet|Cô Lan|Em An/.test(JSON.stringify(n)); })());
  await pT.reload({ waitUntil: "networkidle" }); await hide(pT);
  await pT.getByText("BT nộp tệp").first().click();
  await pT.locator('[data-nop-tep="tutor_return"] [data-nop-tep-tep-tra]').waitFor({ timeout: 30000 });
  check("mở lại bài đã chấm: tệp đã trả hiện kèm 'Gỡ tệp'", (await pT.locator('[data-nop-tep-tep-tra] [data-nop-tep-go]').count()) === 1);
  await shot(pT, "nop-tep-1280-gia-su-da-tra");
  await prisma.submissionFile.updateMany({ where: { submissionId: subs[0].id, kind: "student" }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await pT.reload({ waitUntil: "networkidle" }); await hide(pT);
  await pT.getByText("BT nộp tệp").first().click();
  await pT.locator('[data-nop-tep-ds="het-han"]').waitFor({ timeout: 30000 });
  check("hết hạn phía gia sư: đúng câu, không nút tải tệp học sinh", (await pT.locator('[data-nop-tep-ds="het-han"]').textContent())?.trim() === EXPIRED_TEXT);
  await prisma.submissionFile.updateMany({ where: { submissionId: subs[0].id, kind: "student" }, data: { expiresAt: new Date(Date.now() + 59 * 86_400_000) } });

  section("học sinh thấy tệp gia sư trả; nộp lại hỏi xác nhận");
  await open(p1); await settled(p1);
  check("'Tệp gia sư trả bài' có 'Tải xuống'", (await p1.locator(`${BOX} [data-nop-tep-tep-tra] [data-nop-tep-tai]`).count()) === 1);
  await p1.locator(`${BOX} [data-nop-tep-nop-lai]`).click();
  check("bấm 'Nộp lại bài' mở lại vùng thả + 'Huỷ nộp lại'", await p1.locator(`${BOX} [data-nop-tep-vung-tha]`).isVisible() && await p1.locator(`${BOX} [data-nop-tep-huy]`).isVisible());
  await p1.locator(`${BOX} [data-nop-tep-input]`).setInputFiles(f("lam-lai.docx", docx("lai")));
  await p1.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="san-sang"]`).waitFor({ timeout: 30000 });
  await p1.locator(`${BOX} [data-nop-tep-nop]`).click();
  const dlg = p1.getByRole("dialog");
  await dlg.waitFor({ timeout: 10000 });
  check("hộp xác nhận nói rõ xoá điểm, nhận xét và tệp gia sư đã trả (điểm đã gửi ở bước trước)", /xoá điểm, nhận xét và tệp gia sư đã trả/.test((await dlg.textContent()) ?? ""));
  const nopResp2 = p1.waitForResponse(r => /\/nop-bai\/[^/]+\/nop/.test(r.url()) && r.request().method() === "POST", { timeout: 60000 });
  await dlg.getByRole("button", { name: "Nộp lại" }).click();
  await nopResp2;
  await eventually("nộp lại: tệp cũ removed, bài nộp mới chỉ còn 1 tệp, điểm cũ bị xoá", async () => {
    const s = await prisma.assignmentSubmission.findUnique({ where: { id: subs[0].id } });
    return s?.score === null && (await prisma.submissionFile.count({ where: { submissionId: subs[0].id, status: "ready" } })) === 1;
  }, 30000);

  // ─────────────────────────────────────────────────────────────────────────
  section("tính năng tắt (giả bằng chặn route) ⇒ nói rõ + còn link Azota");
  const c2 = await ctxFor(S2, { width: 1280, height: 900 });
  const p2 = await c2.newPage(); watch(p2);
  await p2.route("**/api/media/nop-bai/danh-sach**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false, reason: "Tính năng nộp tệp chưa bật.", limits: { maxBytes: 10485760, maxFiles: 3, exts: ["docx", "pdf"], retentionDays: 60 }, retentionDays: 60, files: [], submission: null }) }));
  await open(p2); await settled(p2);
  check("câu 'Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota.' (role=status)", (await p2.locator('[data-nop-tep-chua-bat]').getAttribute("role")) === "status" && /Tính năng nộp tệp chưa bật\. Bạn vẫn nộp được bằng link Azota\./.test((await p2.locator('[data-nop-tep-chua-bat]').textContent()) ?? ""));
  check("không có vùng thả và không có 'Nộp bài'; vẫn còn đường link Azota", (await p2.locator(`${BOX} [data-nop-tep-vung-tha]`).count()) === 0 && (await p2.locator(`${BOX} [data-nop-tep-nop]`).count()) === 0 && (await p2.getByText(/azota/i).count()) > 0);
  await shot(p2, "nop-tep-1280-tat");

  section("học sinh đã nghỉ lớp không thấy khối");
  const cX = await ctxFor(SX, { width: 1280, height: 900 });
  const pX = await cX.newPage(); watch(pX);
  await pX.goto(lessonUrl, { waitUntil: "networkidle", timeout: 120000 });
  check("không có khối nộp tệp (thấy thông báo nghỉ lớp có sẵn)", (await pX.locator("[data-nop-tep]").count()) === 0 && (await pX.getByRole("button", { name: "Bài tập" }).count()) === 0);

  // ─────────────────────────────────────────────────────────────────────────
  section("390px: không tràn ngang, nút ≥44px, tên dài cắt giữa, bàn phím");
  await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: A.id, userId: S2.id } });
  const c3 = await ctxFor(S2, { width: 390, height: 844 });
  const p3 = await c3.newPage(); watch(p3);
  await open(p3, lessonUrl); await settled(p3);
  check("390: khối nộp tệp hiện (một cột)", (await p3.locator(BOX).count()) === 1);
  const noScroll = async (p: any, tag: string) => check(`${tag}: không cuộn ngang`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await noScroll(p3, "390 trống");
  check("390: vùng thả cao ≥132px, nút 'Chọn tệp' ≥44px", (((await p3.locator(`${BOX} [data-nop-tep-vung-tha]`).boundingBox())?.height ?? 0) >= 132) && (((await p3.locator(`${BOX} [data-nop-tep-chon]`).boundingBox())?.height ?? 0) >= 44));
  const chooser = p3.waitForEvent("filechooser", { timeout: 10000 });
  await p3.locator(`${BOX} [data-nop-tep-chon]`).click();
  check("390: bấm 'Chọn tệp' mở hộp chọn tệp", !!(await chooser.catch(() => null)));
  await p3.locator(`${BOX} [data-nop-tep-vung-tha]`).focus();
  const ch2 = p3.waitForEvent("filechooser", { timeout: 10000 });
  await p3.keyboard.press("Enter");
  check("bàn phím: vùng thả focus + Enter mở hộp chọn tệp", !!(await ch2.catch(() => null)));
  const ch3 = p3.waitForEvent("filechooser", { timeout: 10000 });
  await p3.keyboard.press("Space");
  check("bàn phím: Space cũng mở hộp chọn tệp", !!(await ch3.catch(() => null)));
  const longName = `${"Bai-lam-rat-dai-".repeat(8)}Toan.docx`;
  await p3.locator(`${BOX} [data-nop-tep-input]`).setInputFiles(f(longName, docx("dai")));
  await p3.locator(`${BOX} [data-nop-tep-hang][data-trang-thai="san-sang"]`).waitFor({ timeout: 30000 });
  const nameEl = p3.locator(`${BOX} [data-nop-tep-ten]`).first();
  check("tên dài: title có đủ tên, không tràn khung (cắt giữa, giữ đuôi .docx)", (await nameEl.getAttribute("title")) === longName && await nameEl.evaluate(e => e.scrollWidth <= (e.parentElement as HTMLElement).clientWidth + 1) && /\.docx$/.test((await nameEl.textContent()) ?? ""));
  const bo = p3.locator(`${BOX} [data-nop-tep-bo]`).first();
  check("390: 'Bỏ tệp' và 'Nộp bài' cao ≥44px, status role=status có chữ", (((await bo.boundingBox())?.height ?? 0) >= 44) && (((await p3.locator(`${BOX} [data-nop-tep-nop]`).boundingBox())?.height ?? 0) >= 44) && (await p3.locator(`${BOX} [data-nop-tep-tom-tat]`).getAttribute("role")) === "status");
  await noScroll(p3, "390 có tệp");
  await shot(p3, "nop-tep-390-co-tep");
  await bo.click();

  check("không có lỗi trang/console ngoài dự kiến", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll().catch(() => {}); process.exit(1); });
