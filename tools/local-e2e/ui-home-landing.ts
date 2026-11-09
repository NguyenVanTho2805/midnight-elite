// BU-HS-LANDING mục 5 "ui-home-landing.ts" — trang chủ công khai theo bố cục hsavnu, dữ liệu THẬT của KiN, trình duyệt thật, 1440 / 1280 / 390 / 320.
// Gồm: (A) thứ tự khối `data-home-block` (khách; học sinh có thêm my-class) + nền đan xen khác nhau; (B) nội dung thật của bốn khối, đề chưa tới giờ KHÔNG là liên kết, khách bấm đề mở → /dang-nhap?redirect=;
//   (C) HTML tĩnh không lộ mã mồi / passwordHash / email gia sư, khách và học sinh cùng thân HTML; (D) khách mở "/" không phát sinh /api/student/*, /api/enrollments, /api/progress;
//   (E) hero (≤440px ở 1280, dòng cuối h1 màu nhấn, MỘT nút đặc), nút ≥44px, không tràn ngang, chữ 130%, dải cuộn có tabindex + aria-label; (F) ca dữ liệu rỗng từng khối + 1 gia sư + rỗng cả bốn;
//   (G) xem trước quản trị /admin/trang-chu/xem-truoc; (H) chữ tiếng Việt thật; (I) 0 pageerror / console.error. Ảnh chụp 1440 + 390 vào ${SHOTS_DIR}.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-home-landing.ts      (KHÔNG chạy cùng bài khác: wipe()).
// Ca phá cố ý (sửa gì trong src/ thì ca nào phải đỏ; stu-test tự bẻ rồi `git checkout` hoàn lại):
//   - HomeExams: bỏ nhánh `open ? <Link> : <span>` (luôn Link) → "đề chưa tới giờ không là liên kết" đỏ; HomeCourses bỏ tabIndex/aria-label của dải cuộn → ca dải cuộn đỏ.
//   - HomeLandingBlocks: đổi thứ tự (Exams trước Courses) → ca "thứ tự khối" đỏ; HomeSections bỏ `data-home-alt` / đổi `nth-child` → ca "nền đan xen" đỏ.
//   - HomeCourses/HomeExams/HomeNews bỏ `if (… .length === 0) return null` → ca "khối rỗng không có trong DOM" đỏ. HomeTutors bỏ `showGrid` → ca "1 gia sư" đỏ.
//   - HomeHeroContact bỏ `min-h-11` → ca "nút ≥44px" đỏ. Thêm fetch("/api/progress") ở khối máy chủ/khách → ca "khách không gọi API học sinh" đỏ.
import { mkdirSync } from "node:fs";
import { BASE, cookieFor, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, closeAll, ADMIN, type Page } from "./ui";

const stamp = Date.now().toString(36);
const BAIT = `MA-MOI-${stamp}`;
const SHOTS_DIR = process.env.SHOTS_DIR ?? "/private/tmp/claude-501/-Users-Admin-Documents-Code-quan-ly-tai-chinh/4ff5b9b0-beb3-4a69-a474-f833d9e0ffa4/scratchpad/shots-hs-landing";
mkdirSync(SHOTS_DIR, { recursive: true });
const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;
const ORDER_GUEST = ["hero", "tutors", "courses", "exams", "news", "community", "score", "why", "cta"];
const ORDER_STUDENT = ["hero", "my-class", "tutors", "courses", "exams", "news", "community", "score", "why"];

let seq = 0;
async function mkExam(o: { title: string; owner: string; date: string; time?: string; secrets?: boolean }) {
  seq++;
  const id = `de-${stamp}-${seq}`;
  const ex = await prisma.exam.create({
    data: {
      id, code: `HSA.${stamp}.${seq}`, title: o.title, category: "ĐGNL HSA", date: o.date, time: o.time ?? "08:00", duration: "90 phút",
      questions: 999, status: "available", createdAt: new Date(Date.now() - seq * 1000).toISOString(),
      ownerId: o.owner, courseId: null, price: null, active: true, activeGuest: true, isDraft: false,
      ...(o.secrets ? { passwordHash: `${BAIT}-PW`, password: `${BAIT}-PW2`, azotaUrl: `https://azota.test/${BAIT}`, participants: 777, clusterScorePercents: [11, 22, 33, 44] } : {}),
    },
  });
  for (let i = 0; i < 2; i++) {
    const q = await prisma.examQuestion.create({ data: { id: `${id}-q${i}`, examId: id, order: i, text: `${BAIT} nội dung câu ${i}`, points: 1, type: "MC", explanation: `${BAIT} lời giải ${i}` } });
    await prisma.examOption.create({ data: { id: `${q.id}-o1`, questionId: q.id, order: 0, text: `${BAIT} đáp án đúng`, isCorrect: true } });
    await prisma.examOption.create({ data: { id: `${q.id}-o2`, questionId: q.id, order: 1, text: `${BAIT} đáp án sai`, isCorrect: false } });
  }
  return ex;
}
const ddmmyyyy = (d: Date) => { const v = new Date(d.getTime() + 7 * 3_600_000); return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`; };

(async () => {
  await wipe();
  await prisma.siteContent.deleteMany({});
  // ═════ Thế giới thử ═════
  const TA = await mkTutor(`Cô Lan Hiện ${stamp}`);
  const TB = await mkTutor(`Thầy Bình Hiện ${stamp}`);
  const TC = await mkTutor(`Cô Chi Hiện ${stamp}`);
  const SECRET_PHONE = "0911222333", SECRET_SCHOOL = `Trường Bí Mật ${stamp}`;
  await prisma.user.update({ where: { id: TA.id }, data: { subjects: ["Toán 12"], bio: "Dạy Toán luyện thi", phone: SECRET_PHONE, school: SECRET_SCHOOL, city: "Hà Nội" } });
  await prisma.user.update({ where: { id: TB.id }, data: { subjects: ["Vật lí 11"] } });
  await prisma.user.update({ where: { id: TC.id }, data: { subjects: ["Hoá học 10"] } });
  const admin = await mkSuper(`Quản trị Đề ${stamp}`);
  const S = await mkUser({ name: "Minh Anh Học Sinh" });

  const cats = ["ĐGNL HSA", "ĐGNL HSA", "ĐGNL HSA", "ĐGNL HCM", "ĐGNL HCM", "TSA", "TSA"];
  const courseIds: string[] = [];
  for (let i = 0; i < cats.length; i++) {
    const c = await mkCourse([TA, TB, TC][i % 3].id, { name: `Lớp mẫu ${i + 1} ${cats[i]} ${stamp}` });
    await prisma.course.update({ where: { id: c.id }, data: { category: cats[i], price: i === 3 ? 0 : 500000 + i * 100000, sortOrder: i } });
    courseIds.push(c.id);
  }
  await prisma.enrollment.create({ data: { userId: S.id, courseId: courseIds[0], status: "active" } });

  const future = new Date(Date.now() + 40 * 86_400_000);
  const upcoming = await mkExam({ title: `Đề CHƯA TỚI GIỜ ${stamp}`, owner: admin.id, date: ddmmyyyy(future), time: "19:30" });
  const opens: Awaited<ReturnType<typeof mkExam>>[] = [];
  for (let i = 0; i < 5; i++) opens.push(await mkExam({ title: `Đề ĐANG MỞ ${i + 1} ${stamp}`, owner: admin.id, date: `0${i + 1}/09/2026`, secrets: i === 0 }));
  const examIds = [upcoming.id, ...opens.map(e => e.id)];
  const articleIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const a = await prisma.article.create({ data: { slug: `tin-mau-${i}-${stamp}`, title: `Tin mẫu ${i + 1} ${stamp}`, excerpt: `Tóm tắt tin ${i + 1}`, content: `${BAIT} nội dung dài ${i}`, category: "tuyen-sinh", author: "KiN", authorId: admin.id, published: true, publishedAt: new Date(Date.now() - (i + 1) * 3_600_000) } });
    articleIds.push(a.id);
  }

  /** Đưa DB về trạng thái "có / không có" từng loại dữ liệu (idempotent). */
  const setAvail = async (a: { tutors: 0 | 1 | 3; courses: boolean; exams: boolean; news: boolean }) => {
    const visible = [TA, TB, TC].map((_, i) => i < a.tutors);
    for (const [i, t] of [TA, TB, TC].entries()) await prisma.user.update({ where: { id: t.id }, data: { preferences: visible[i] ? {} : { profile: { hidden: true } } } });
    await prisma.course.updateMany({ where: { id: { in: courseIds } }, data: { status: a.courses } });
    await prisma.exam.updateMany({ where: { id: { in: examIds } }, data: { active: a.exams } });
    await prisma.article.updateMany({ where: { id: { in: articleIds } }, data: { published: a.news } });
  };
  const FULL = { tutors: 3 as const, courses: true, exams: true, news: true };
  await setAvail(FULL);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration|negative time stamp/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 300)}`); }); };
  const open = async (u: Awaited<ReturnType<typeof mkUser>> | null, w: number, path = "/", h = 900, asAdmin = false) => {
    const c = await ctxFor(u, { width: w, height: h });
    const p = await c.newPage(); watch(p);
    await p.addInitScript(`window.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "[data-agentation-root]{display:none!important}"; document.head.appendChild(s); });`);
    await p.goto(`${asAdmin ? ADMIN : BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    return { c, p };
  };
  const ready = async (p: Page, student = false) => {
    await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120000 });
    await p.locator('[data-home-block="community"]:not([data-home-state="loading"])').waitFor({ timeout: 60000 });
    if (student) await p.locator('[data-home-block="my-class"][data-home-state="ok"]').waitFor({ timeout: 60000 });
    await p.waitForTimeout(500);
  };
  const shot = async (p: Page, name: string) => { await p.screenshot({ path: `${SHOTS_DIR}/${name}.png`, fullPage: true }); };
  /** Khối cấp cao theo thứ tự DOM (bỏ khối lồng nhau như quiz trong community). */
  const blocks = (p: Page) => p.evaluate(`[...document.querySelectorAll('[data-home-block]')].filter(e => !e.parentElement.closest('[data-home-block]')).map(e => e.getAttribute('data-home-block'))`) as Promise<string[]>;
  const count = (p: Page, b: string) => p.locator(`[data-home-block="${b}"]`).count();
  const small = (p: Page, scope: string) => p.evaluate(`(() => { const out = []; for (const e of document.querySelectorAll(${JSON.stringify(scope)} + ' a[href], ' + ${JSON.stringify(scope)} + ' button, ' + ${JSON.stringify(scope)} + ' input, ' + ${JSON.stringify(scope)} + ' select, ' + ${JSON.stringify(scope)} + ' summary')) { if (e.closest('[data-feedback-toolbar],[data-annotation-popup],[data-agentation-root],[inert],.sr-only')) continue; const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue; if (r.height < 43.5) out.push(((e.getAttribute('aria-label') || e.textContent || e.getAttribute('href') || e.tagName).trim().slice(0, 40)) + ' = ' + Math.round(r.height)); } return [...new Set(out)]; })()`) as Promise<string[]>;
  const LANDING_SCOPES = ['[data-home-block="hero"]', '[data-home-block="tutors"]', '[data-home-block="courses"]', '[data-home-block="exams"]', '[data-home-block="news"]', '[data-home-block="why"]', '[data-home-block="cta"]'];
  /** Nền tính ra của từng khối cấp cao + hai token nền, để so sánh. */
  const bgs = (p: Page) => p.evaluate(`(() => { const tok = n => { const d = document.createElement('div'); d.style.background = 'var(' + n + ')'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
    const list = [...document.querySelectorAll('[data-home-block]')].filter(e => !e.parentElement.closest('[data-home-block]')).map(e => [e.getAttribute('data-home-block'), getComputedStyle(e).backgroundColor]);
    return { trang: tok('--kin-nen-trang'), bang: tok('--kin-nen-bang'), navy: tok('--kin-nhan-nen'), list }; })()`) as Promise<{ trang: string; bang: string; navy: string; list: [string, string][] }>;

  // ═════════════════════════ A. Thứ tự khối và nền đan xen ═════════════════════════
  section("A · khách 1440: thứ tự khối hero → tutors → courses → exams → news → community → score → why → cta; nền đan xen khác nhau");
  {
    const { c, p } = await open(null, 1440);
    await ready(p);
    const order = await blocks(p);
    check("thứ tự khối của khách đúng đặc tả", order.join() === ORDER_GUEST.join(), order);
    const b = await bgs(p);
    check("hai token nền trắng / tô nhạt là hai màu KHÁC nhau (để phép so nền có nghĩa)", b.trang !== b.bang, b);
    check("hero nền navy (--kin-nhan-nen)", b.list[0][1] === b.navy, b.list[0]);
    const inAlt = b.list.filter(([n]) => n !== "hero");
    check("mỗi khối sau hero có nền là trắng HOẶC tô nhạt (không màu lạ)", inAlt.every(([, bg]) => bg === b.trang || bg === b.bang), inAlt);
    check("nền hai khối KỀ NHAU khác nhau (không có hai khối liền màu)", inAlt.every(([, bg], i) => i === 0 || bg !== inAlt[i - 1][1]), inAlt);
    check("khối đầu sau hero (tutors) nền trắng; khối thứ hai (courses) tô nhạt", inAlt[0][1] === b.trang && inAlt[1][1] === b.bang, inAlt.slice(0, 2));
    check("khung data-home-alt tồn tại và bọc các khối từ tutors đến cta", await p.locator("[data-home-alt] > section").count() === 8, await p.locator("[data-home-alt] > section").count());
    await shot(p, "khach-1440"); await c.close();
  }
  section("A · học sinh 1440: có my-class ngay sau hero, không còn cta; nền vẫn đan xen");
  {
    const { c, p } = await open(S, 1440);
    await ready(p, true);
    await p.locator('[data-home-cta-final]').waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    const order = await blocks(p);
    check("thứ tự khối của học sinh: có my-class ngay sau hero, không cta", order.join() === ORDER_STUDENT.join(), order);
    const b = await bgs(p);
    const after = b.list.filter(([n]) => n !== "hero");
    check("nền hai khối kề nhau khác nhau (my-class → tutors → …)", after.every(([, bg], i) => i === 0 || bg !== after[i - 1][1]), after);
    check("my-class nền tô nhạt, tutors (khối đầu của khung) nền trắng: học sinh đăng nhập không đổi màu các khối sau", after[0][1] === b.bang && after[1][1] === b.trang, after.slice(0, 2));
    // khối sau my-class của học sinh phải cùng màu như bản khách (không đảo)
    const g = await open(null, 1440); await ready(g.p);
    const bg2 = await bgs(g.p);
    const pick = (l: [string, string][], n: string) => l.find(([x]) => x === n)?.[1];
    check("màu của tutors / courses / exams / news / community / score / why giống hệt bản khách", ["tutors", "courses", "exams", "news", "community", "score", "why"].every(n => pick(b.list, n) === pick(bg2.list, n)), [b.list, bg2.list]);
    await g.c.close();
    await shot(p, "hocsinh-1440"); await c.close();
  }

  // ═════════════════════════ B. Nội dung thật của bốn khối ═════════════════════════
  section("B · khách 1440: nội dung thật (gia sư, lớp theo kỳ thi, đề, tin) và liên kết");
  {
    const { c, p } = await open(null, 1440);
    await ready(p);
    const tut = p.locator('[data-home-block="tutors"]');
    check("khối Gia sư: lưới ≥ 2 thẻ, mỗi thẻ là liên kết /mentor/<id>, có tên gia sư thật", await tut.locator('a[href^="/mentor/"]').count() >= 2 && (await tut.innerText()).includes(`Cô Lan Hiện ${stamp}`));
    check("khối Gia sư: có nút 'Tìm gia sư' → /giang-vien và liên kết 'Đăng ký gia sư' → /dang-ky?vai=gia-su", (await tut.getByRole("link", { name: "Tìm gia sư", exact: true }).getAttribute("href")) === "/giang-vien" && (await tut.getByRole("link", { name: "Đăng ký gia sư" }).getAttribute("href")) === "/dang-ky?vai=gia-su");
    check("khối Gia sư: không hiện email / SĐT / trường / thành phố của gia sư", !(await tut.innerText()).match(new RegExp(`${SECRET_PHONE}|${SECRET_SCHOOL}|Hà Nội|@test.local`)));
    const crs = p.locator('[data-home-block="courses"]');
    const nCourse = await crs.locator("[data-home-course]").count();
    check("khối Lớp: 1–6 thẻ lớp thật, mỗi thẻ là liên kết /khoa-hoc/<id>", nCourse >= 3 && nCourse <= 6 && await crs.locator('a[href^="/khoa-hoc/"]').count() === nCourse, nCourse);
    check("khối Lớp: chip kỳ thi cho cả ba kỳ thi, liên kết /khoa-hoc?category=<tên>", await crs.locator('a[href^="/khoa-hoc?category="]').count() === 3 && !!(await crs.locator('a[href="/khoa-hoc?category=%C4%90GNL%20HSA"]').count()));
    check("khối Lớp: lớp giá 0 ghi 'Miễn phí', lớp có phí ghi số tiền + 'đ'; KHÔNG có số học viên / sĩ số", await crs.locator('[data-price="free"]').count() >= 1 && await crs.locator('[data-price="paid"]').count() >= 1 && !/\d+\s*(học viên|học sinh)|đang học|sĩ số/i.test(await crs.innerText()));
    check("khối Lớp: 'Xem tất cả lớp học →' → /khoa-hoc", (await crs.getByRole("link", { name: /Xem tất cả lớp học/ }).getAttribute("href")) === "/khoa-hoc");
    const exs = p.locator('[data-home-block="exams"]');
    check("khối Thi thử: 6 thẻ đề ở 1440", await exs.locator("[data-home-exam]").count() === 6, await exs.locator("[data-home-exam]").count());
    const up = exs.locator(`[data-home-exam="${upcoming.id}"]`), op = exs.locator(`[data-home-exam="${opens[0].id}"]`);
    check("đề CHƯA TỚI GIỜ: KHÔNG là liên kết (0 thẻ <a>), có chữ 'Mở lúc 19:30 ngày dd/mm', không có 'Vào thi ngay'", await up.locator("a").count() === 0 && /Mở lúc 19:30 ngày \d{2}\/\d{2}/.test(await up.innerText()) && !/Vào thi ngay/.test(await up.innerText()), await up.innerText());
    check("đề ĐANG MỞ: có đúng một liên kết /student/thi-thu/<id>, chữ 'Vào thi ngay →', ghi 'Miễn phí' và số câu", (await op.locator("a").count()) === 1 && (await op.locator("a").getAttribute("href")) === `/student/thi-thu/${opens[0].id}` && /Vào thi ngay →/.test(await op.innerText()) && /Miễn phí/.test(await op.innerText()) && /2 câu/.test(await op.innerText()), await op.innerText());
    check("khối Thi thử: không số thí sinh / điểm / hạng / đáp án", !/thí sinh|điểm trung bình|xếp hạng|777/i.test(await exs.innerText()));
    check("khối Thi thử: 'Xem tất cả đề thi thử →' → /thi-thu", (await exs.getByRole("link", { name: /Xem tất cả đề thi thử/ }).getAttribute("href")) === "/thi-thu");
    const nw = p.locator('[data-home-block="news"]');
    check("khối Tin: đúng 3 bài (có 4 bài đã đăng), mỗi bài là liên kết /tin-tuc/<slug>", await nw.locator("[data-home-news]").count() === 3 && await nw.locator('a[href^="/tin-tuc/"]').count() === 3, await nw.locator("[data-home-news]").count());
    check("khối Tin: 'Xem tất cả tin tức →' → /tin-tuc", (await nw.getByRole("link", { name: /Xem tất cả tin tức/ }).getAttribute("href")) === "/tin-tuc");
    // khách bấm đề đang mở → đăng nhập kèm redirect
    await op.locator("a").click();
    await p.waitForURL(u => u.pathname === "/dang-nhap", { timeout: 90000 });
    const redirect = new URL(p.url()).searchParams.get("redirect");
    check("khách bấm đề đang mở → /dang-nhap?redirect=%2Fstudent%2Fthi-thu%2F<id>", redirect === `/student/thi-thu/${opens[0].id}` && p.url().includes(`redirect=%2Fstudent%2Fthi-thu%2F${opens[0].id}`), p.url());
    await c.close();
  }

  // ═════════════════════════ C. HTML tĩnh ═════════════════════════
  section("C · HTML máy chủ (không cookie): có tên lớp / gia sư / đề / bài; KHÔNG có mã mồi, passwordHash, email gia sư; khách và học sinh cùng thân HTML");
  {
    const g1 = await fetch(`${BASE}/`); const gt = await g1.text();
    check("200 và có tên gia sư / lớp / đề / bài mẫu trong HTML ban đầu", g1.status === 200 && gt.includes(`Cô Lan Hiện ${stamp}`) && gt.includes(`Lớp mẫu 1 ĐGNL HSA ${stamp}`) && gt.includes(`Đề ĐANG MỞ 1 ${stamp}`) && gt.includes(`Tin mẫu 1 ${stamp}`));
    check("không chứa mã mồi (lời giải, đáp án, nội dung câu, mật khẩu đề, azota, nội dung bài viết)", !gt.includes(BAIT), gt.slice(Math.max(0, gt.indexOf(BAIT) - 40), gt.indexOf(BAIT) + 60));
    for (const k of ["passwordHash", "azotaUrl", "clusterScorePercents", "isCorrect", "explanation", "ownerId", "participants"]) check(`HTML không có "${k}"`, !gt.includes(k));
    check("HTML không chứa email gia sư / SĐT / trường của gia sư / tên học sinh", !gt.includes(TA.email) && !gt.includes(TB.email) && !gt.includes("@test.local") && !gt.includes(SECRET_PHONE) && !gt.includes(SECRET_SCHOOL) && !gt.includes("Minh Anh Học Sinh"));
    const norm = (s: string) => s.replace(/\s+/g, " ").replace(/"[a-f0-9]{8,}"/g, '""').replace(/nonce="[^"]*"/g, "").replace(/__next_r="[^"]*"/g, "").replace(/\bdata-precedence="[^"]*"/g, "");
    const st = await (await fetch(`${BASE}/`, { headers: { cookie: await cookieFor(S) } })).text();
    check("thân HTML kèm cookie học sinh = thân HTML của khách", norm(gt) === norm(st), [gt.length, st.length]);
    check("khối 'Lớp của tôi' không nằm trong HTML máy chủ (cả khách lẫn học sinh)", !/data-home-block="my-class"/.test(gt) && !/data-home-block="my-class"/.test(st));
  }

  // ═════════════════════════ D. Khách không gọi API học sinh ═════════════════════════
  section("D · khách mở '/' không phát sinh yêu cầu tới /api/student/*, /api/enrollments, /api/progress");
  {
    const c = await ctxFor(null, { width: 1440, height: 900 });
    const p = await c.newPage(); watch(p);
    const hit: string[] = [];
    p.on("request", r => { const u = new URL(r.url()); if (/^\/api\/(student\/|enrollments|progress)/.test(u.pathname)) hit.push(u.pathname); });
    await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await ready(p); await p.waitForTimeout(3000);
    check("0 yêu cầu tới API học sinh khi khách mở '/'", hit.length === 0, hit);
    await c.close();
  }

  // ═════════════════════════ E. Hero, nút ≥44px, không tràn, chữ 130%, dải cuộn ═════════════════════════
  for (const w of [1440, 1280, 390, 320]) {
    section(`E · khách ${w}px: hero, nút ≥44px, không tràn ngang, chữ 130%, dải cuộn`);
    const { c, p } = await open(null, w);
    await ready(p);
    const sm = (await Promise.all(LANDING_SCOPES.map(s => small(p, s)))).flat();
    check(`${w}px: không nút / liên kết nào cao < 44px trong hero, gia sư, lớp (chip), đề, tin, lợi ích, CTA (kể cả dải 'Cần tư vấn?')`, sm.length === 0, sm.slice(0, 8));
    const contact = p.locator("[data-home-hero-contact]");
    check(`${w}px: dải 'Cần tư vấn?' có liên kết gọi (tel:0384409051) và Zalo, cao ≥ 44px`, (await contact.locator('a[href="tel:0384409051"]').count()) === 1 && (await contact.locator('a[href^="https://zalo.me/"]').count()) === 1 && ((await contact.locator("a").first().boundingBox())?.height ?? 0) >= 43.5);
    check(`${w}px: không tràn ngang`, await p.evaluate(NOT_OVERFLOW) as boolean, await p.evaluate(`document.documentElement.scrollWidth + " > " + innerWidth`));
    // Hero: chỉ MỘT nút đặc; dòng cuối h1 có màu nhấn
    const solid = await p.evaluate(`(() => { const alpha = s => { if (!s || s === 'transparent') return 0; const m = s.match(/\\/\\s*([\\d.]+%?)\\s*\\)/); if (m) return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]); const r = s.match(/^rgba\\(([^)]*)\\)/); if (r) { const a = r[1].split(',')[3]; return a === undefined ? 1 : parseFloat(a); } return 1; };
      return [...document.querySelectorAll('[data-home-block=hero] a[href], [data-home-block=hero] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && alpha(getComputedStyle(e).backgroundColor) >= 0.9; }).map(e => e.textContent.trim()); })()`) as string[];
    check(`${w}px: hero có ĐÚNG MỘT nút đặc ('Xem lớp học')`, solid.length === 1 && /Xem lớp học/.test(solid[0]), solid);
    if (w === 1280 || w === 1440) {
      const hh = (await p.locator('[data-home-block="hero"]').boundingBox())?.height ?? 0;
      check(`${w}px: hero cao ≤ 440px (đo được ${Math.round(hh)})`, hh <= 440, hh);
    }
    if (w === 1440) {
      const acc = await p.evaluate(`(() => { const a = document.querySelector('[data-home-title-accent]'); const d = document.createElement('i'); d.style.color = 'var(--kin-th-vang-nang)'; document.body.appendChild(d); const want = getComputedStyle(d).color; d.remove(); return { n: document.querySelectorAll('[data-home-title-accent]').length, got: a ? getComputedStyle(a).color : null, want, txt: a ? a.textContent : null }; })()`) as { n: number; got: string | null; want: string; txt: string | null };
      check("dòng cuối của h1 có màu --kin-th-vang-nang (tiêu đề ≥ 2 dòng)", acc.n === 1 && acc.got === acc.want, acc);
    }
    const strip = p.locator('[data-home-block="courses"] ul[aria-label^="Lớp đang mở"]');
    check(`${w}px: dải cuộn của 'Lớp' có tabindex="0" và aria-label`, (await strip.getAttribute("tabindex")) === "0" && !!(await strip.getAttribute("aria-label")));
    if (w <= 390) {
      const sc = await strip.evaluate(e => ({ ox: getComputedStyle(e).overflowX, sw: e.scrollWidth, cw: e.clientWidth }));
      check(`${w}px: dải 'Lớp' cuộn ngang được (overflow-x auto, scrollWidth > clientWidth) mà trang không tràn`, sc.ox === "auto" && sc.sw > sc.cw && await p.evaluate(NOT_OVERFLOW) as boolean, sc);
      const nVis = await p.locator("[data-home-exam]").evaluateAll(els => els.filter(e => (e as HTMLElement).getBoundingClientRect().height > 0).length);
      check(`${w}px: khối Thi thử hiện 4 đề đầu (đề 5–6 ẩn trên điện thoại)`, nVis === 4, nVis);
    }
    await p.addStyleTag({ content: "html{font-size:130% !important}" });
    await p.waitForTimeout(400);
    check(`${w}px: chữ phóng 130% vẫn không tràn ngang`, await p.evaluate(NOT_OVERFLOW) as boolean, await p.evaluate(`document.documentElement.scrollWidth + " > " + innerWidth`));
    if (w === 390) await shot(p, "khach-390");
    await c.close();
  }
  for (const w of [1440, 390]) {
    section(`E · học sinh ${w}px: hero + my-class, nút ≥44px, không tràn ngang`);
    const { c, p } = await open(S, w);
    await ready(p, true);
    const sm = (await Promise.all([...LANDING_SCOPES.slice(0, 5), '[data-home-block="my-class"]'].map(s => small(p, s)))).flat();
    check(`học sinh ${w}px: không nút / liên kết nào cao < 44px trong các khối landing và my-class`, sm.length === 0, sm.slice(0, 8));
    check(`học sinh ${w}px: không tràn ngang`, await p.evaluate(NOT_OVERFLOW) as boolean);
    if (w === 390) await shot(p, "hocsinh-390");
    await c.close();
  }

  // ═════════════════════════ F. Ca dữ liệu rỗng ═════════════════════════
  const cases: { name: string; avail: Parameters<typeof setAvail>[0]; absent: ("courses" | "exams" | "news")[]; tutors: "grid" | "text-only" }[] = [
    { name: "không có lớp", avail: { ...FULL, courses: false }, absent: ["courses"], tutors: "grid" },
    { name: "không có đề thi thử", avail: { ...FULL, exams: false }, absent: ["exams"], tutors: "grid" },
    { name: "không có bài tin", avail: { ...FULL, news: false }, absent: ["news"], tutors: "grid" },
    { name: "không có gia sư", avail: { ...FULL, tutors: 0 }, absent: [], tutors: "text-only" },
    { name: "chỉ 1 gia sư", avail: { ...FULL, tutors: 1 }, absent: [], tutors: "text-only" },
    { name: "rỗng cả bốn (không gia sư, lớp, đề, bài)", avail: { tutors: 0, courses: false, exams: false, news: false }, absent: ["courses", "exams", "news"], tutors: "text-only" },
  ];
  const HEAD: Record<string, RegExp> = { courses: /Lớp luyện thi theo từng kỳ thi/, exams: /Đề thi thử đang mở/, news: /Tin giáo dục và tuyển sinh/ };
  const LABEL: Record<string, RegExp> = { courses: /Lớp đang mở/i, exams: /Thi thử miễn phí/i, news: /^Tin tức$/i };
  for (const cs of cases) {
    section(`F · ${cs.name}: khối rỗng không có trong DOM, không tiêu đề, nền vẫn đan xen`);
    await setAvail(cs.avail);
    for (const w of [1440, 390]) {
      const { c, p } = await open(null, w);
      await ready(p);
      const order = await blocks(p);
      const want = ORDER_GUEST.filter(b => !cs.absent.includes(b as never));
      check(`${w}px: thứ tự khối còn lại đúng (${want.join(" → ")})`, order.join() === want.join(), order);
      for (const a of cs.absent) {
        check(`${w}px: [data-home-block="${a}"] có 0 phần tử`, (await count(p, a)) === 0);
        check(`${w}px: không còn tiêu đề của khối ${a} trong trang`, !HEAD[a].test(await p.locator("main").innerText()));
      }
      if (cs.absent.includes("exams")) {
        const others = await p.locator('[data-home-block]:not([data-home-block="hero"]):not([data-home-block="cta"])').allInnerTexts();
        check(`${w}px: không còn nhãn 'Thi thử miễn phí' ở bất kỳ khối nào (nút hero vẫn còn)`, !others.some(t => LABEL.exams.test(t) && /Đề thi thử đang mở/.test(t)) && !(await p.locator("main").innerText()).includes("Đề thi thử đang mở") && await p.locator('[data-home-block="hero"]').getByRole("link", { name: "Thi thử miễn phí" }).count() === 1);
      }
      void LABEL;
      // Gia sư
      const tut = p.locator('[data-home-block="tutors"]');
      check(`${w}px: khối Gia sư luôn còn chữ 'Đang tìm gia sư?' + nút 'Tìm gia sư' → /giang-vien`, (await tut.getByRole("heading", { level: 2, name: "Đang tìm gia sư?" }).count()) === 1 && (await tut.getByRole("link", { name: "Tìm gia sư", exact: true }).getAttribute("href")) === "/giang-vien");
      const nT = await tut.locator('a[href^="/mentor/"]').count();
      if (cs.tutors === "text-only") check(`${w}px: chỉ còn chữ + nút (data-home-state=text-only), KHÔNG có lưới / thẻ gia sư nào (${nT})`, (await tut.getAttribute("data-home-state")) === "text-only" && nT === 0, nT);
      else check(`${w}px: lưới gia sư còn nguyên (≥ 2 thẻ)`, (await tut.getAttribute("data-home-state")) === "ok" && nT >= 2, nT);
      // không khối nào có 0 thẻ con
      const empties = await p.evaluate(`(() => { const out = []; for (const [b, sel] of [['courses','[data-home-course]'],['exams','[data-home-exam]'],['news','[data-home-news]']]) { const el = document.querySelector('[data-home-block="' + b + '"]'); if (el && !el.querySelector(sel)) out.push(b); } const t = document.querySelector('[data-home-block="tutors"][data-home-state="ok"]'); if (t && !t.querySelector('[data-tutor-card]')) out.push('tutors'); return out; })()`) as string[];
      check(`${w}px: không khối dữ liệu nào có 0 thẻ con`, empties.length === 0, empties);
      const b = await bgs(p);
      const inAlt = b.list.filter(([n]) => n !== "hero");
      check(`${w}px: nền hai khối kề nhau vẫn khác nhau sau khi bớt khối`, inAlt.every(([, bg], i) => i === 0 || bg !== inAlt[i - 1][1]), inAlt);
      check(`${w}px: không tràn ngang`, await p.evaluate(NOT_OVERFLOW) as boolean);
      if (cs.absent.length === 3 || cs.name === "chỉ 1 gia sư" || cs.name === "không có đề thi thử") await shot(p, `rong-${cs.name.replace(/[^a-zà-ỹ0-9]+/gi, "-")}-${w}`);
      await c.close();
    }
  }
  await setAvail(FULL);

  // ═════════════════════════ G. Xem trước quản trị ═════════════════════════
  section("G · /admin/trang-chu/xem-truoc: vẽ được với DEFAULT_HOME_CONTENT, không khối dữ liệu, vẫn có 'Đang tìm gia sư?'");
  {
    const { c, p } = await open(admin, 1280, "/admin/trang-chu/xem-truoc", 900, true);
    await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 120000 });
    await p.waitForTimeout(800);
    const order = await blocks(p);
    check("xem trước chỉ có hero, why, cta (không tutors / courses / exams / news / community / score) dù DB có đủ dữ liệu", order.join() === "hero,why,cta", order);
    check("xem trước vẫn có chữ 'Đang tìm gia sư?' và nút 'Tìm gia sư'", await p.getByRole("heading", { level: 2, name: "Đang tìm gia sư?" }).count() === 1 && await p.getByRole("link", { name: "Tìm gia sư", exact: true }).count() === 1);
    check("xem trước hiện h1 mặc định, không khối số liệu (dl), không thẻ gia sư / lớp / đề / tin", /Học cùng gia sư thật/.test(await p.getByRole("heading", { level: 1 }).first().innerText()) && await p.locator("dl").count() === 0 && await p.locator("[data-tutor-card], [data-home-course], [data-home-exam], [data-home-news]").count() === 0);
    check("xem trước không tràn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
    await c.close();
  }

  // ═════════════════════════ H. Chữ thật ═════════════════════════
  section("H · chữ tiếng Việt thật, không chữ mẫu");
  {
    const { c, p } = await open(null, 1440);
    await ready(p);
    const text = await p.locator("main").innerText();
    const FAKE = /Lorem|Sample|Tên giáo viên|(?<![\d.])00\.000/i; // "500.000đ" là giá thật, chỉ "00.000" đứng riêng mới là chữ mẫu
    check("không có 'Lorem', 'Sample', 'Tên giáo viên', '00.000'", !FAKE.test(text), text.match(FAKE));
    check("không có chữ bịa của HSA (Học viên nói gì / Bảng vàng / Phụ huynh nói / lời chứng thực)", !/Học viên nói gì|Bảng vàng|Phụ huynh nói|lời chứng thực/i.test(text));
    check("không có số '+' kiểu '50.000+ học viên'", !/\d{1,3}(\.\d{3})+\+|\d+\+\s*(học viên|học sinh|gia sư|giáo viên|đề)/i.test(text));
    await c.close();
  }

  check("không có pageerror / console.error ở mọi trang đã mở", errors.length === 0, errors.slice(0, 6));
  await closeAll();
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
