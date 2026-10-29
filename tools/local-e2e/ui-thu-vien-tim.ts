// NC2-046 — ô tìm của trang Thư viện + trang quản trị "Video tham khảo" (trình duyệt thật + cơ sở dữ liệu thật).
// Quản trị: thêm video bằng link (kiểm ngay khi gõ, ảnh xem trước), trùng bị báo, bật / tắt công khai, xoá có hộp xác nhận.
// Khách / học sinh: gõ KHÔNG dấu vẫn ra; chờ ngừng gõ mới gọi (không gọi từng chữ); phản hồi cũ không ghi đè phản hồi mới; lỗi mạng có "Thử lại";
// học sinh trong lớp thấy thêm "Trong lớp của bạn" (tài liệu riêng của lớp), học sinh ngoài lớp và khách KHÔNG thấy chữ nào của tài liệu riêng; 390px không tràn ngang.
import { BASE, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, closeAll, shot, ADMIN, type Page, type BrowserContext } from "./ui";
import { prisma } from "@/lib/prisma";

const ID1 = "dQw4w9WgXcQ";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#8ab"/></svg>`;
const rndIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" }), O = await mkUser({ name: "Bạn Ngoài Lớp" });
  const C1 = await mkCourse(T.id, { name: "Sử 12 nâng cao" }), C2 = await mkCourse(T.id, { name: "Khoá đã đóng" });
  await prisma.course.update({ where: { id: C1.id }, data: { status: true } });
  await prisma.course.update({ where: { id: C2.id }, data: { status: false } });
  const sec1 = await prisma.section.create({ data: { id: "s1", title: "Phần 1", order: 1, courseId: C1.id } }), ch1 = await prisma.chapter.create({ data: { id: "ch1", title: "Chương 1", order: 1, sectionId: sec1.id } });
  const sec2 = await prisma.section.create({ data: { id: "s2", title: "Phần 1", order: 1, courseId: C2.id } }), ch2 = await prisma.chapter.create({ data: { id: "ch2", title: "Chương 1", order: 1, sectionId: sec2.id } });
  const docs = (name: string, url: string) => JSON.stringify([{ name, url, type: "pdf" }]);
  const lesson = (id: string, title: string, o: Record<string, unknown>, ch: string) => prisma.lesson.create({ data: { id, code: id, title, type: "record", order: 1, chapterId: ch, ...o } as never });
  await lesson("lPub", "Bài 5 Thế giới sau 1945", { isFree: true, documents: docs("Chiến tranh lạnh - tóm tắt.pdf", "https://files.example/cong-khai.pdf") }, ch1.id);
  await lesson("lPriv", "Bài 6 Chiến tranh lạnh nâng cao", { isFree: false, isLocked: false, videoUrl: "https://youtu.be/riengcualop", documents: docs("Chiến tranh lạnh - đề cương nội bộ.pdf", "https://files.example/rieng-cua-lop.pdf") }, ch1.id);
  await lesson("lClosed", "Bài đóng", { isFree: true, documents: docs("Chiến tranh lạnh - khoá đóng.pdf", "https://files.example/khoa-dong.pdf") }, ch2.id);
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C1.id, status: "active" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 500)}`); }); };
  const stubImages = async (c: BrowserContext) => { await c.route("https://i.ytimg.com/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG })); await c.setExtraHTTPHeaders({ "x-forwarded-for": rndIp() }); };
  const text = (p: Page) => p.locator("body").innerText();

  // ───────────── Quản trị
  section("Quản trị: thêm video bằng link, trùng bị báo, công khai, xoá");
  const ca = await ctxFor(SA, { width: 1280, height: 1000 });
  await ca.route("https://i.ytimg.com/**", r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG }));
  const ap = await ca.newPage(); watch(ap);
  await ap.goto(`${ADMIN}/admin/thu-vien-video`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await ap.getByRole("heading", { level: 1, name: "Video tham khảo (YouTube)" }).waitFor({ timeout: 120000 });
  await ap.locator("[data-add-video]").waitFor({ timeout: 60000 });
  check("trang trống nói rõ 'Chưa có video nào'; ghi rõ KiN không quét YouTube và không lưu video", /Chưa có video nào/.test(await text(ap)) && /không quét YouTube/.test(await text(ap)));
  await ap.locator("[data-add-video]").click();
  const form = ap.locator("[data-video-form]");
  await form.waitFor({ timeout: 30000 });
  check("form mới: chưa có link → xem trước báo 'Chưa hợp lệ'", /Chưa hợp lệ/.test(await ap.locator("[data-video-preview]").innerText()));
  await ap.fill("#vd-url", "https://vimeo.com/123"); await ap.fill("#vd-title", "Chiến tranh lạnh 1947–1991");
  check("link không phải YouTube → xem trước báo 'Link YouTube chưa đúng'", /Link YouTube chưa đúng/.test(await ap.locator("[data-video-preview]").innerText()));
  await ap.fill("#vd-url", `https://youtu.be/${ID1}?t=3`); await ap.fill("#vd-topics", "Chiến tranh lạnh, Lịch sử 12");
  await eventually("link đúng → xem trước hiện mã video + 2 chủ đề + ảnh nhỏ", async () => { const t = await ap.locator("[data-video-preview]").innerText(); return t.includes(ID1) && /2 chủ đề/.test(t) && (await ap.locator("[data-video-preview] img").count()) === 1; }, 8000);
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("lưu → form đóng, dòng mới hiện, DB có 1 video NHÁP với mã đúng", async () => (await form.count()) === 0 && (await ap.locator("[data-video-row]").count()) === 1 && (await prisma.libraryVideo.count({ where: { videoId: ID1, published: false } })) === 1, 20000);
  check("dòng: tiêu đề, chủ đề, 'Bản nháp', ảnh nhỏ, link 'Mở trên YouTube' mở tab mới an toàn", await (async () => { const row = ap.locator("[data-video-row]"); const a = row.getByRole("link", { name: /Mở trên YouTube/ }); const t = await row.innerText(); return /Chiến tranh lạnh 1947/.test(t) && /Lịch sử 12/.test(t) && /Bản nháp/.test(t) && (await row.locator("img").count()) === 1 && (await a.getAttribute("target")) === "_blank" && /noopener/.test((await a.getAttribute("rel")) ?? "") && (await a.getAttribute("href")) === `https://www.youtube.com/watch?v=${ID1}`; })());
  await shot(ap, "thu-vien-video-admin");
  await ap.locator("[data-add-video]").click();
  await form.waitFor({ timeout: 30000 });
  await ap.fill("#vd-url", `https://www.youtube.com/watch?v=${ID1}`); await ap.fill("#vd-title", "Trùng");
  await form.getByRole("button", { name: "Lưu" }).click();
  await eventually("thêm lại CÙNG video → báo 'Video này đã có trong kho', form vẫn mở, vẫn 1 dòng", async () => /đã có trong kho/.test(await form.getByRole("alert").innerText()) && (await prisma.libraryVideo.count()) === 1, 15000);
  await form.getByRole("button", { name: "Huỷ" }).click();
  await ap.getByRole("switch", { name: /Công khai: Chiến tranh lạnh/ }).click();
  await eventually("bật công khai bằng công tắc → DB published=true, nhãn 'Công khai'", async () => (await prisma.libraryVideo.findFirstOrThrow()).published === true && /Công khai/.test(await ap.locator("[data-video-row]").innerText()), 15000);
  await ap.getByRole("button", { name: /^Sửa Chiến tranh lạnh/ }).click();
  await ap.locator("#vd-title").waitFor({ timeout: 20000 });
  check("mở để sửa: form điền sẵn link, tiêu đề, chủ đề", (await ap.inputValue("#vd-url")) === `https://www.youtube.com/watch?v=${ID1}` && (await ap.inputValue("#vd-title")) === "Chiến tranh lạnh 1947–1991" && (await ap.inputValue("#vd-topics")) === "Chiến tranh lạnh, Lịch sử 12");
  await ap.locator("[data-video-form]").getByRole("button", { name: "Huỷ" }).click();

  // ───────────── Khách
  section("Khách: tìm KHÔNG dấu ra tài liệu công khai + video; không ra tài liệu riêng");
  const cg = await ctxFor(null, { width: 1280, height: 900 }); await stubImages(cg);
  const gp = await cg.newPage(); watch(gp);
  const apiCalls: string[] = [];
  gp.on("request", r => { if (r.url().includes("/api/thu-vien/tim")) apiCalls.push(decodeURIComponent(new URL(r.url()).searchParams.get("q") ?? "")); });
  await gp.goto(`${BASE}/thu-vien`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await gp.getByRole("heading", { level: 1, name: "Thư viện" }).waitFor({ timeout: 120000 });
  const box = gp.locator("#kho-q");
  await box.waitFor({ timeout: 60000 });
  check("có ô tìm có nhãn 'Tìm tài liệu và video' và gợi ý 'chiến tranh lạnh'", await gp.getByRole("searchbox", { name: "Tìm tài liệu và video" }).isVisible() && /chiến tranh lạnh/.test((await box.getAttribute("placeholder")) ?? ""));
  await box.fill("a");
  check("gõ 1 ký tự → báo 'Gõ ít nhất 2 ký tự', KHÔNG gọi máy chủ", /Gõ ít nhất 2 ký tự/.test(await text(gp)) && (await gp.locator("[data-kho-results]").count()) === 0);
  await gp.waitForTimeout(600);
  check("…và quả thật chưa có yêu cầu nào tới /api/thu-vien/tim", apiCalls.length === 0, apiCalls);
  await box.fill("");
  await box.pressSequentially("chien tranh lanh", { delay: 60 });
  await gp.locator("[data-kho-video]").first().waitFor({ timeout: 20000 });
  check("gõ từng chữ liên tục → chỉ gọi máy chủ 1 lần (chờ ngừng gõ), với đúng từ khoá cuối", apiCalls.length === 1 && apiCalls[0] === "chien tranh lanh", apiCalls);
  check("ra 1 tài liệu công khai và 1 video; tiêu đề nhóm có số lượng", (await gp.locator("[data-kho-doc]").count()) === 1 && (await gp.locator("[data-kho-video]").count()) === 1 && /Tài liệu công khai \(1\)/.test(await text(gp)) && /Video tham khảo \(1\)/.test(await text(gp)));
  const vid = gp.locator("[data-kho-video] a").first();
  check("video: mở youtube.com ở tab mới (noopener noreferrer), có ảnh nhỏ no-referrer, chủ đề, kênh, và dòng 'không phải bản ghi lớp học'", (await vid.getAttribute("href")) === `https://www.youtube.com/watch?v=${ID1}` && (await vid.getAttribute("target")) === "_blank" && /noopener/.test((await vid.getAttribute("rel")) ?? "") && /noreferrer/.test((await vid.getAttribute("rel")) ?? "") && (await vid.locator("img").getAttribute("referrerpolicy")) === "no-referrer" && /Lịch sử 12/.test(await vid.innerText()) && /không phải bản ghi lớp học/.test(await text(gp)));
  const doc = gp.locator("[data-kho-doc] a").first();
  check("tài liệu: mở trang xem trước của KiN ở tab mới; có chip PDF", ((await doc.getAttribute("href")) ?? "").startsWith("/xem-tai-lieu?url=") && (await doc.getAttribute("target")) === "_blank" && /PDF/.test(await doc.innerText()));
  const pageText = await text(gp);
  check("KHÔNG có chữ nào của tài liệu RIÊNG của lớp, khoá đóng; KHÔNG có nhóm 'Trong lớp của bạn'", !/đề cương nội bộ|rieng-cua-lop|khoá đóng|khoa-dong|Trong lớp của bạn/.test(pageText), pageText.slice(0, 300));
  check("hai liên kết kết quả cao ≥ 44px (chạm được)", ((await vid.boundingBox())?.height ?? 0) >= 44 && ((await doc.boundingBox())?.height ?? 0) >= 44);
  await shot(gp, "thu-vien-tim-khach");

  section("Khách: không có kết quả, xoá ô, lỗi mạng + Thử lại");
  await box.fill("xyzabc");
  await gp.locator("[data-kho-empty]").waitFor({ timeout: 15000 });
  check("không khớp → 'Không có kết quả cho “xyzabc”' kèm gợi ý có dấu / không dấu", /Không có kết quả cho “xyzabc”/.test(await gp.locator("[data-kho-empty]").innerText()) && /không dấu đều được/.test(await gp.locator("[data-kho-empty]").innerText()));
  await box.fill("");
  check("xoá ô → khung kết quả biến mất", (await gp.locator("[data-kho-results]").count()) === 0);
  await gp.route("**/api/thu-vien/tim**", r => r.abort());
  await box.fill("lich su 12");
  await gp.getByRole("alert").filter({ hasText: "Không tìm được lúc này" }).waitFor({ timeout: 15000 });
  check("lỗi mạng → báo 'Không tìm được lúc này' kèm nút 'Thử lại' (không im lặng, không 'không có kết quả')", (await gp.locator("[data-kho-empty]").count()) === 0);
  await gp.unroute("**/api/thu-vien/tim**");
  await gp.getByRole("button", { name: "Thử lại" }).click();
  await gp.locator("[data-kho-video]").first().waitFor({ timeout: 15000 });
  check("bấm Thử lại khi đã có mạng → ra video theo CHỦ ĐỀ ('lich su 12') dù tiêu đề không có", (await gp.locator("[data-kho-video]").count()) === 1 && (await gp.locator("[data-kho-doc]").count()) === 0);

  section("Khách: phản hồi của lần gõ CŨ không ghi đè lần mới");
  await box.fill("");
  let slow = 0;
  await gp.route("**/api/thu-vien/tim?q=chien*", async r => { slow++; await new Promise(res => setTimeout(res, 3500)); await r.continue(); });
  await box.fill("chien tranh");
  await eventually("lần gõ 1 ('chien tranh') đã gửi nhưng phản hồi bị giữ 3,5 giây", () => slow === 1, 6000);
  await box.fill("lich su 12");
  await gp.locator("[data-kho-video]").first().waitFor({ timeout: 10000 });
  await gp.waitForTimeout(4500);
  check("sau khi phản hồi cũ về: vẫn là kết quả của 'lich su 12' (chỉ video, KHÔNG có tài liệu của 'chien tranh')", (await gp.locator("[data-kho-doc]").count()) === 0 && (await gp.locator("[data-kho-video]").count()) === 1);
  await gp.unroute("**/api/thu-vien/tim?q=chien*");

  // ───────────── Học sinh trong lớp
  section("Học sinh TRONG lớp: thấy thêm 'Trong lớp của bạn'");
  const cs = await ctxFor(S, { width: 1280, height: 900 }); await stubImages(cs);
  const sp = await cs.newPage(); watch(sp);
  await sp.goto(`${BASE}/thu-vien`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await sp.getByRole("heading", { level: 1, name: "Thư viện" }).waitFor({ timeout: 120000 });
  await sp.getByText("Không gian học tập").waitFor({ timeout: 60000 });
  await sp.waitForTimeout(1500);
  await sp.locator("#kho-q").fill("chien tranh lanh");
  await sp.locator("[data-kho-own]").first().waitFor({ timeout: 10000 });
  const own = await sp.locator("[data-kho-own]").allInnerTexts();
  check("nhóm 'Trong lớp của bạn' (3 mục) có bài 6, tài liệu riêng 'đề cương nội bộ' và tài liệu 'tóm tắt' của bài 5 (lớp mình)", /Trong lớp của bạn \(3\)/.test(await text(sp)) && own.some(t => /Bài 6 Chiến tranh lạnh nâng cao/.test(t)) && own.some(t => /đề cương nội bộ/.test(t)) && own.some(t => /tóm tắt/.test(t)), own);
  check("bài riêng mở ở /student/bai-giang/…; tài liệu riêng mở trang xem trước", (await sp.locator("[data-kho-own] a").evaluateAll(els => els.map(e => e.getAttribute("href")))).some(h => h === "/student/bai-giang/lPriv") && (await sp.locator("[data-kho-own] a").evaluateAll(els => els.map(e => e.getAttribute("href")))).some(h => (h ?? "").startsWith("/xem-tai-lieu?url=")));
  await sp.locator("[data-kho-video]").first().waitFor({ timeout: 20000 });
  check("…có thêm video; tài liệu công khai của CHÍNH lớp mình không lặp lại ở nhóm 'Tài liệu công khai' (nhóm đó biến mất vì không còn gì khác)", (await sp.locator("[data-kho-video]").count()) === 1 && (await sp.locator("[data-kho-doc]").count()) === 0 && (await sp.locator("[data-kho-docs]").count()) === 0);
  check("KHÔNG ra tài liệu của khoá đóng", !/khoá đóng|khoa-dong/.test(await text(sp)));
  await shot(sp, "thu-vien-tim-hoc-sinh");

  // ───────────── Học sinh ngoài lớp
  section("Học sinh NGOÀI lớp: không thấy chữ nào của tài liệu riêng");
  const co = await ctxFor(O, { width: 1280, height: 900 }); await stubImages(co);
  const op = await co.newPage(); watch(op);
  await op.goto(`${BASE}/thu-vien`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await op.getByRole("heading", { level: 1, name: "Thư viện" }).waitFor({ timeout: 120000 });
  await op.getByText("Không gian học tập").waitFor({ timeout: 60000 });
  await op.waitForTimeout(1500);
  await op.locator("#kho-q").fill("chien tranh lanh");
  await op.locator("[data-kho-video]").first().waitFor({ timeout: 20000 });
  const ot = await text(op);
  check("thấy tài liệu công khai + video, KHÔNG có 'Trong lớp của bạn', KHÔNG có chữ nào của tài liệu riêng / khoá đóng / bài 6", (await op.locator("[data-kho-doc]").count()) === 1 && !/Trong lớp của bạn|đề cương nội bộ|rieng-cua-lop|Bài 6|khoá đóng/.test(ot), ot.slice(0, 300));

  // ───────────── Điện thoại
  section("390px");
  const cm = await ctxFor(S, { width: 390, height: 844 }); await stubImages(cm);
  const mp = await cm.newPage(); watch(mp);
  await mp.goto(`${BASE}/thu-vien`, { waitUntil: "domcontentloaded", timeout: 150000 });
  await mp.getByRole("heading", { level: 1, name: "Thư viện" }).waitFor({ timeout: 120000 });
  await mp.waitForTimeout(2500);
  await mp.locator("#kho-q").fill("chien tranh lanh");
  await mp.locator("[data-kho-video]").first().waitFor({ timeout: 20000 });
  check("không tràn ngang ở 390px (có nhóm 'Trong lớp của bạn' và video)", (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && (await mp.locator("[data-kho-own]").count()) >= 1);
  await shot(mp, "thu-vien-tim-390");

  check("không lỗi JS / console trên mọi trang", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(async e => { console.error("CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
