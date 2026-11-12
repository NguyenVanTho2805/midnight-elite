// BU-HS-TRANG-CHU mục 8 — CỬA VỀ Trang chủ từ khu học sinh và Trang chủ có Lớp của tôi / bảng tin / quiz / tính điểm. 1600 / 1280 / 390 / 320; khách và học sinh đăng nhập.
// Gồm: (A) cửa về ở từng màn có vỏ (mục Trang chủ trong thanh module, logo, thu thanh bên → liên kết ở dải trên, điện thoại: logo + hàng đầu bảng "Khác"), không `aria-current`, phòng thi không có lối về;
//       (B) "/" mở được với học sinh đã đăng nhập (không bị ép sang /student), khối theo vai; (C) ba trạng thái từng khối (chặn / giả lập route); (D) bảng tin: không tên đầy đủ / trường / lớp, không nhắn riêng;
//       (E) tính điểm: tính ở trình duyệt, không có request nào phát sinh; (F) mọi nút / liên kết ≥ 44px, không tràn ngang, chữ 130%; (G) trang vẫn tĩnh; (H) mô hình kẻ tấn công miền học sinh.
// Ca phá cố ý (stu-test chạy THẬT 09/11/2026 trên cổng 3100, mỗi ca sửa src rồi `git checkout` hoàn lại; số đỏ là số ca đỏ THÊM so với nền 16 đỏ có sẵn của FeedCard + logo Navbar):
//   (1) HomeCtaGuard luôn trả children → +5 đỏ ("CTA cuối ẨN" của học sinh 1600/1280, gia sư, gia sư chờ duyệt, quản trị);
//   (2) HomeCommunity đổi scope "common" → "all" → +1 đỏ ("học sinh trong lớp: KHÔNG có bài riêng của lớp");
//   (3) ModuleRail `matches` dùng startsWith(href) (không có "/") → 26 đỏ ở A1 (mục Trang chủ sáng ở mọi trang /student/*, aria-current ×2; chạy cùng ca 4, bài sập ở A4 trước khi sửa timeout);
//   (4) bỏ `data-mobile-home` khỏi logo điện thoại ở StudentShell → +4 đỏ (390 và 320: không có logo để bấm).
import { BASE, api, cookieFor, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { featureOn } from "@/lib/features";
import { homeNavFor } from "@/lib/homeLayout";

// LOI-07 (11/11/2026): kỳ vọng THEO CỜ LOI-01 (src/lib/features.ts), đọc ở tiến trình bài — chạy với CÙNG biến NEXT_PUBLIC_KIN_MO_* như máy chủ dev.
// Tắt hết: thanh module không có "Lịch học" (điện thoại 3 ô), bảng "Khác" chỉ còn "Lớp miễn phí", trang chủ không có bảng tin / quiz (nằm trong bảng tin) / tính điểm,
// Navbar chỉ "Lớp học · Thi thử" (+ "Lớp của tôi" cho học sinh) — các phần C2, C3, D, E chỉ chạy khi phần tương ứng mở; khi ẩn thì kiểm khối KHÔNG có và không gọi API bảng tin.
// Bật đủ 9 cờ: như trước LOI-01.
const CD = featureOn("CONG_DONG"), DC = featureOn("DIEM_CHUAN"), LICH = featureOn("LICH");
const QUIZ = CD && process.env.KIN_HOME_QUIZ !== "0"; // khối quiz nằm trong bảng tin (homeLayout.homeBlocksFor)
const MORE_EXPECT = ["Lớp miễn phí", ...(featureOn("TIM_GIA_SU") ? ["Gia sư"] : []), ...(CD ? ["Cộng đồng"] : []), ...(featureOn("TIN_TUC") ? ["Tin tức"] : []), ...(featureOn("TIENG_ANH") ? ["Tiếng Anh tự học"] : [])];
const NAV_GUEST = homeNavFor({ kind: "guest" }).map(i => i.label).join("|"), NAV_STUDENT = homeNavFor({ kind: "student" }).map(i => i.label).join("|");
const BAR_CELLS = LICH ? 4 : 3; // Việc của tôi · (Lịch học) · Lớp của tôi · Khác

import { FEATURES as KIN_FEATURES, featureOn as kinFeatureOn } from "@/lib/features";

// LOI-01 (11/11/2026): bài này khẳng định ĐỦ menu / khối trang chủ của các phần mà LOI-01 mặc định ẨN (Lịch, Cộng đồng, Tin tức, Thư viện, Tìm gia sư, Tiếng Anh, Xếp hạng, Coin, Điểm chuẩn).
// Chạy với NEXT_PUBLIC_KIN_MO_<TÊN>=1 (bật hết) cho CẢ máy chủ dev lẫn bài (cùng env.sh) mới có nghĩa; cờ đang tắt thì bỏ qua có thông báo thay vì đỏ vì thiếu mục đang bị ẩn có chủ đích.
// Hành vi KHI ẨN do bài của LOI-01 phủ: t-features-lib, ui-links-everywhere, ui-role-everything, ui-tutor-shell, ui-student-shell, ui-coin-an, ui-loi-cong-dong-lop.
const KIN_OFF = KIN_FEATURES.filter(k => !kinFeatureOn(k));
if (KIN_OFF.length) {
  console.log(`\n(BỎ QUA cả bài: LOI-01 đang ẨN ${KIN_OFF.join(", ")}. Chạy với NEXT_PUBLIC_KIN_MO_<TÊN>=1 cho cả máy chủ dev và bài để kiểm đủ menu/khối.)\n0 pass / 0 fail`);
  process.exit(0);
}

const stamp = Date.now().toString(36);
const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;
const FULL_NAME = "Nguyễn Văn Quân Anh";
const SCHOOL = `THPT Bí Mật ${stamp}`;
const CLASS_ONLY = `BAI-RIENG-CUA-LOP-${stamp}`;
const FORBIDDEN_KEYS = ["email", "phone", "zaloPhone", "school", "highSchool", "city", "dateOfBirth", "avatarBase64", "guestIpHash", "reviewedById", "rejectReason", "password", "passwordHash", "correct", "isCorrect", "answerKey", "explanation"];
const keysIn = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach(x => keysIn(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_KEYS.includes(k)) out.push(k); keysIn(x, out); }
  return out;
};

(async () => {
  await wipe();
  // ═════ Thế giới thử ═════
  const T = await mkTutor("Cô Lan Hương");
  const TP = await mkUser({ name: "Gia sư chờ duyệt" });
  await prisma.user.update({ where: { id: TP.id }, data: { tutorAppliedAt: new Date() } });
  const A = await mkSuper("Quản Trị");
  const S = await mkUser({ name: "Minh Anh" });
  const S0 = await mkUser({ name: "Bạn Mới" });
  const SM = await mkUser({ name: "Học Nhiều Lớp" });
  const ST = await mkUser({ name: "Thu Thanh Bên" }); // chỉ dùng ở ca A3: phím "[" / nút thu GHI ưu tiên thanh bên vào TÀI KHOẢN (PUT /api/users/me/preferences) nên không được làm với S
  const AUTH = await mkUser({ name: FULL_NAME });
  await prisma.user.update({ where: { id: AUTH.id }, data: { phone: "0912345678", zaloPhone: "0987654321", school: SCHOOL, highSchool: SCHOOL, city: `Thành Phố Bí Mật ${stamp}`, dateOfBirth: new Date("2010-03-04") } });
  const C1 = await mkCourse(T.id, { name: "Toán 9 trang chủ" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C1.id, status: "active" } });
  const sid = `s-hd-${stamp}`, cid = `c-hd-${stamp}`, lid = `l-hd-${stamp}`;
  await prisma.section.create({ data: { id: sid, title: "Chương 1", courseId: C1.id } });
  await prisma.chapter.create({ data: { id: cid, title: "Bài 1", sectionId: sid } });
  await prisma.lesson.create({ data: { id: lid, code: lid, title: "Bài giảng đầu", type: "record", chapterId: cid } });
  const lid2 = `l2-hd-${stamp}`;
  await prisma.lesson.create({ data: { id: lid2, code: lid2, title: "Bài giảng hai", type: "record", chapterId: cid, order: 2 } });
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: lid, watchedSeconds: 100, completed: true } });
  const many: string[] = [];
  for (let i = 0; i < 4; i++) { const c = await mkCourse(T.id, { name: `Lớp số ${i + 1} của em` }); many.push(c.id); await prisma.enrollment.create({ data: { userId: SM.id, courseId: c.id, status: "active" } }); }
  const exam = await prisma.exam.create({ data: { id: `ex-hd-${stamp}`, code: `ex-hd-${stamp}`, title: "Đề thử cửa về", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId: C1.id } });

  // Bảng tin: 7 bài chung (đầu tiên của học sinh có thông tin riêng), 1 bài RIÊNG của lớp, 1 bài chờ duyệt của khách.
  const mkPost = (authorId: string, content: string, o: { courseId?: string; status?: string; at?: number } = {}) => prisma.thread.create({ data: { authorId, content, kind: "post", category: "kinh-nghiem", courseId: o.courseId ?? null, status: o.status ?? "published", createdAt: new Date(Date.now() - (o.at ?? 0) * 60_000) } });
  for (let i = 0; i < 7; i++) await mkPost(i === 0 ? AUTH.id : T.id, `BAI-CHUNG-${stamp}-${i}`, { at: i });
  await mkPost(T.id, CLASS_ONLY, { courseId: C1.id });
  await mkPost(AUTH.id, `BAI-CHO-DUYET-${stamp}`, { status: "pending" });
  // Công thức tính điểm công khai
  const formula = await prisma.admissionFormula.create({ data: { name: "Khối A00", school: "Trường thử", year: 2026, scale: 30, inputs: [{ key: "m1", label: "Toán", max: 10, weight: 2 }, { key: "m2", label: "Lý", max: 10, weight: 1 }, { key: "m3", label: "Hoá", max: 10, weight: 1 }], multiplier: 0.75, bonuses: [{ key: "b1", label: "Điểm ưu tiên", max: 2.75 }], sourceUrl: "https://example.edu.vn/thong-bao", sourceName: "example.edu.vn", verified: false, published: true } });

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|net::ERR|status of (4|5)|Hydration|negative time stamp|Mất kết nối|Unexpected token/i.test(m.text())) errors.push(`${p.url()} :: ${m.text().slice(0, 300)}`); }); };
  type U = Awaited<ReturnType<typeof mkUser>> | null;
  const open = async (u: U, w: number, path: string, o: { h?: number; rail?: "mo" | "rong" | "thu" | "mac-dinh"; setup?: (p: Page) => Promise<void> } = {}) => {
    const c = await ctxFor(u, { width: w, height: o.h ?? 900, rail: o.rail ?? "mo" });
    const p = await c.newPage(); watch(p);
    await p.addInitScript(`window.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "[data-agentation-root]{display:none!important}"; document.head.appendChild(s); });`);
    if (o.setup) await o.setup(p);
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    return { c, p };
  };
  // Trang chủ đã vẽ phần máy khách: có bảng tin thì chờ khối bảng tin; ẩn thì chờ khối "Học ở đây thì được gì?" (luôn có) rồi đợi máy khách quyết xong.
  const homeReady = async (p: Page, settle = true) => { await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 }); if (CD) await p.locator('[data-home-block="community"]').waitFor({ timeout: 60000 }); else { await p.locator('[data-home-block="why"]').first().waitFor({ timeout: 60000 }); if (settle) await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}); } };
  // LOI-07: ca "đang tải" (C1) chặn API 3 giây rồi nhả — KHÔNG chờ networkidle ở đó (networkidle chờ chính lời gọi bị giữ, đến khi bắt kịp thì khung xương đã mất).
  const blockState = (p: Page, b: string) => p.locator(`[data-home-block="${b}"]`).first().getAttribute("data-home-state");
  const waitState = (p: Page, b: string, s: string, ms = 30000) => p.locator(`[data-home-block="${b}"][data-home-state="${s}"]`).first().waitFor({ timeout: ms });
  const railName = "Module của học sinh";
  const pathOf = (p: Page) => new URL(p.url()).pathname;
  const h = async (loc: ReturnType<Page["locator"]>) => Math.round((await loc.boundingBox())?.height ?? 0);
  // Mục / liên kết nhìn thấy cao < 44px (bỏ thanh công cụ dev, phần tử sr-only, liên kết nằm giữa dòng chữ). Trả "tên = cao" kèm tiền tố "[thẻ bài]" nếu nằm trong `[data-feed-card]` (FeedCard dùng chung với /cong-dong).
  const small = (p: Page, scope: string) => p.evaluate(`(() => { const out = []; for (const e of document.querySelectorAll(${JSON.stringify(scope)} + ' a[href], ' + ${JSON.stringify(scope)} + ' button, ' + ${JSON.stringify(scope)} + ' input, ' + ${JSON.stringify(scope)} + ' select, ' + ${JSON.stringify(scope)} + ' summary')) { if (e.closest('[data-feedback-toolbar],[data-annotation-popup],[data-agentation-root],[inert],.sr-only')) continue; const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue; if (r.height < 43.5) out.push((e.closest('[data-feed-card]') ? '[thẻ bài] ' : '') + (e.getAttribute('aria-label') || e.textContent || e.getAttribute('href') || e.tagName).trim().slice(0, 40).replace(/BAI-CHUNG-\\S+/, '<nội dung bài>').replace(/\\d+ (phút|giờ|ngày) trước/, '<N phút trước>') + ' = ' + Math.round(r.height)); } return [...new Set(out)]; })()`) as Promise<string[]>;

  // ═════════════════════════ A. Cửa về từ khu học sinh ═════════════════════════
  section("A1 · 1280 (thanh hẹp): MỌI màn có vỏ có đúng một liên kết 'Trang chủ' nhìn thấy trong thanh module + logo; bấm → '/' và Ở LẠI '/'");
  const doors = ["/student/viec-cua-toi", "/student/lich-hoc", "/student/hoc-tap", `/student/hoc-tap?course=${C1.id}`, `/student/bai-giang/${lid}`, "/student/ho-so", "/student/hoc-phi", "/lop-cua-toi", `/lop-cua-toi/${C1.id}`, "/cong-dong", "/tin-tuc", "/giang-vien", "/khoa-hoc", "/cai-dat/chu-de"];
  {
    const c = await ctxFor(S, { width: 1280, height: 800, rail: "mo" });
    for (const [i, path] of doors.entries()) {
      const p = await c.newPage(); watch(p);
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
      const rail = p.getByRole("navigation", { name: railName }).first();
      await rail.waitFor({ timeout: 120000 });
      await p.waitForTimeout(400);
      const info = await p.evaluate(`(() => { const nv = [...document.querySelectorAll('nav[aria-label="${railName}"]')].find(n => getComputedStyle(n).position !== "fixed"); const vis = e => !!e.offsetParent && e.getBoundingClientRect().height > 0; const links = [...nv.querySelectorAll('a[href="/"]')].filter(vis); const mod = links.filter(a => !a.hasAttribute('data-rail-home')); const logo = links.filter(a => a.hasAttribute('data-rail-home')); const cur = [...nv.querySelectorAll('[aria-current]')].filter(vis).length; return { mod: mod.map(a => [(a.textContent || '').trim(), Math.round(a.getBoundingClientRect().height), a.getAttribute('aria-current')]), logo: logo.map(a => [a.getAttribute('aria-label'), Math.round(a.getBoundingClientRect().height)]), cur, firstText: ((([...nv.querySelectorAll('.kin-rail-items a')].filter(vis))[0]) || {}).textContent }; })()`) as any;
      const label = path.replace(/lop-\w+-\d+(-\w+)?|l-hd-\w+/g, "<id>");
      check(`${label}: đúng 1 mục 'Trang chủ' trong thanh module (cao ≥ 44px, KHÔNG aria-current), đứng đầu thanh`, info.mod.length === 1 && info.mod[0][0] === "Trang chủ" && info.mod[0][1] >= 44 && info.mod[0][2] === null && String(info.firstText).trim().startsWith("Trang chủ"), info);
      check(`${label}: logo thanh bên → '/' có nhãn 'KiN — Trang chủ', cao ≥ 44px; có ≤ 1 mục aria-current trong thanh`, info.logo.length === 1 && info.logo[0][0] === "KiN — Trang chủ" && info.logo[0][1] >= 44 && info.cur <= 1, info);
      // bấm mục Trang chủ ở nửa đầu danh sách, bấm logo ở nửa sau (cả hai đều được thử ở ≥ 6 màn)
      const useLogo = i % 2 === 1;
      await (useLogo ? rail.locator("[data-rail-home]") : rail.getByRole("link", { name: "Trang chủ", exact: true })).first().click();
      await p.waitForURL(u => u.pathname === "/", { timeout: 120000 });
      await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 90000 });
      await p.waitForTimeout(3000);
      check(`${label}: bấm ${useLogo ? "logo" : "mục Trang chủ"} → '/' và ở lại '/' sau 3 giây (không 307 sang Việc của tôi)`, pathOf(p) === "/", p.url());
      check(`${label}: ở '/' có Navbar 'Điều hướng chính' và KHÔNG có thanh bên module`, (await p.getByRole("navigation", { name: "Điều hướng chính" }).isVisible()) && (await p.getByRole("navigation", { name: railName }).count()) === 0);
      await p.close();
    }
    await c.close();
  }

  section("A2 · 1280 và 1600 (thanh RỘNG 272px): 'Trang chủ' đứng đầu nhóm 'Làm việc hằng ngày'; logo → '/'");
  for (const w of [1280, 1600]) {
    const { c, p } = await open(S, w, "/student/viec-cua-toi", { rail: "mac-dinh" });
    const rail = p.getByRole("navigation", { name: railName }).first();
    await rail.waitFor({ timeout: 120000 });
    await p.waitForTimeout(500);
    const g = await p.evaluate(`(() => { const nv = [...document.querySelectorAll('nav[aria-label="${railName}"]')].find(n => getComputedStyle(n).position !== "fixed"); const grp = nv.querySelector('.kin-rail-groups [role="group"]'); const links = [...grp.querySelectorAll('a')]; return { title: grp.getAttribute('aria-label'), items: links.map(a => (a.textContent || '').trim()), first: links[0].getAttribute('href'), firstCur: links[0].getAttribute('aria-current'), firstH: Math.round(links[0].getBoundingClientRect().height), width: Math.round(document.querySelector('#kin-rail').getBoundingClientRect().width) }; })()`) as any;
    const wantItems = ["Trang chủ", "Việc của tôi", ...(LICH ? ["Lịch học"] : []), "Lớp của tôi"].join("|");
    check(`${w}px: thanh rộng ${g.width}px, nhóm đầu '${g.title}' = ${g.items.join(" | ")} (Trang chủ đầu; cần ${wantItems}), → '/', không aria-current`, g.width === 272 && g.items[0] === "Trang chủ" && g.first === "/" && g.firstCur === null && g.firstH >= 36 && g.items.join("|") === wantItems, g);
    await rail.locator(".kin-rail-groups").getByRole("link", { name: "Trang chủ", exact: true }).click();
    await p.waitForURL(u => u.pathname === "/", { timeout: 120000 });
    await p.waitForTimeout(2500);
    check(`${w}px (thanh rộng): bấm 'Trang chủ' → '/' ở lại '/'`, pathOf(p) === "/", p.url());
    await c.close();
  }

  section("A3 · thu thanh bên: liên kết 'Trang chủ KiN' ở dải trên (≥ 44px); mở lại thanh thì biến mất");
  {
    const o = await open(ST, 1280, "/student/lich-hoc", { rail: "mo" });
    await o.p.getByRole("heading", { level: 1, name: "Lịch học" }).waitFor({ timeout: 120000 });
    check("thanh hẹp (không thu, tài khoản chưa từng thu): KHÔNG có [data-top-home]", (await o.p.locator("[data-top-home]").count()) === 0);
    await o.c.close();
    const { c, p } = await open(ST, 1280, "/student/lich-hoc", { rail: "thu" });
    await p.getByRole("heading", { level: 1, name: "Lịch học" }).waitFor({ timeout: 120000 });
    const top = p.locator("[data-top-home]");
    await top.waitFor({ timeout: 30000 });
    check("thanh thu: có [data-top-home] chữ 'Trang chủ KiN' → '/', cao ≥ 44px, nhìn thấy", (await top.innerText()).trim() === "Trang chủ KiN" && (await top.getAttribute("href")) === "/" && (await h(top)) >= 44 && await top.isVisible());
    await p.keyboard.press("[");
    await eventually("phím '[' mở lại thanh → [data-top-home] biến mất", async () => (await p.locator("[data-top-home]").count()) === 0, 8000);
    await p.keyboard.press("[");
    await eventually("thu lần nữa → liên kết hiện lại", async () => (await p.locator("[data-top-home]").count()) === 1, 8000);
    await p.locator("[data-top-home]").click();
    await p.waitForURL(u => u.pathname === "/", { timeout: 120000 });
    await p.waitForTimeout(2500);
    check("bấm 'Trang chủ KiN' khi thanh thu → '/' ở lại '/'", pathOf(p) === "/", p.url());
    await c.close();
  }

  for (const w of [390, 320]) {
    section(`A4 · ${w}px: logo điện thoại ≥ 44px → '/'; bảng 'Khác' có hàng đầu 'Trang chủ KiN'; thanh dưới vẫn 4 ô; không tràn ngang`);
    const { c, p } = await open(S, w, "/student/viec-cua-toi", { h: 800 });
    const bar = p.getByRole("navigation", { name: railName }).last();
    await bar.waitFor({ timeout: 120000 });
    await p.locator("[data-student-task], [data-student-empty], h1").first().waitFor({ timeout: 60000 });
    const lg = p.locator("[data-mobile-home]");
    const lb = await lg.boundingBox({ timeout: 8000 }).catch(() => null); // thiếu logo → ca ĐỎ chứ không treo 30 giây rồi sập bài
    check(`${w}px: logo [data-mobile-home] → '/', nhãn 'KiN — Trang chủ', rộng và cao ≥ 44px`, !!lb && lb.width >= 44 && lb.height >= 44 && (await lg.getAttribute("href", { timeout: 3000 }).catch(() => null)) === "/" && (await lg.getAttribute("aria-label", { timeout: 3000 }).catch(() => null)) === "KiN — Trang chủ", lb);
    const four = await p.evaluate(`[...document.querySelectorAll('nav[aria-label="${railName}"] a, nav[aria-label="${railName}"] button')].filter(e => e.offsetParent && getComputedStyle(e.closest('nav')).position === 'fixed').map(e => [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)])`) as number[][];
    check(`${w}px: thanh dưới vẫn ĐÚNG ${BAR_CELLS} ô (${BAR_CELLS - 1} module + Khác; "Lịch học" ${LICH ? "có" : "ẩn theo cờ LICH"}), mỗi ô ≥ 44×44 (mục Trang chủ không lên thanh dưới)`, four.length === BAR_CELLS && four.every(([a, b]) => a >= 44 && b >= 44), four);
    check(`${w}px: không có liên kết 'Trang chủ KiN' ở dải trên bằng chữ (chỉ máy tính, khi thu thanh); không tràn ngang`, (await p.locator("[data-top-home]").isVisible().catch(() => false)) === false && await p.evaluate(NOT_OVERFLOW) as boolean);
    await bar.getByRole("button", { name: /^Khác/ }).click();
    const dm = p.getByRole("dialog", { name: "Các mục khác" });
    await dm.waitFor({ timeout: 15000 });
    const first = dm.getByRole("link").first();
    check(`${w}px: bảng Khác — hàng ĐẦU là 'Trang chủ KiN' → '/', cao ≥ 44px; còn ${MORE_EXPECT.length} mục theo cờ (${MORE_EXPECT.join(", ")}; tổng ${MORE_EXPECT.length + 1}), không có mục bị cấm`,
      (await first.innerText()).trim() === "Trang chủ KiN" && (await first.getAttribute("href")) === "/" && (await h(first)) >= 44 && (await dm.getByRole("link").count()) === MORE_EXPECT.length + 1
      && (await dm.getByRole("link", { name: /^(Thư viện|Thi thử|Bảng xếp hạng|Hỏi đáp|Khoá học đang mở|Lớp đang theo dõi|Tra cứu điểm chuẩn|Ví và Coin)$/ }).count()) === 0);
    if (w === 390) await shot(p, "home-doors-390-khac");
    await first.click();
    await p.waitForURL(u => u.pathname === "/", { timeout: 120000 });
    await p.waitForTimeout(2500);
    check(`${w}px: bấm hàng 'Trang chủ KiN' → '/' ở lại '/', bảng tự đóng`, pathOf(p) === "/" && (await p.getByRole("dialog", { name: "Các mục khác" }).count()) === 0, p.url());
    await p.goBack();
    await p.waitForTimeout(1500);
    if (await p.locator("[data-mobile-home]").count() === 0) check(`${w}px: bấm logo điện thoại → '/' ở lại '/' (không có logo [data-mobile-home] để bấm)`, false);
    else {
      await p.locator("[data-mobile-home]").click();
      await p.waitForURL(u => u.pathname === "/", { timeout: 120000 });
      await p.waitForTimeout(2500);
      check(`${w}px: bấm logo điện thoại → '/' ở lại '/'`, pathOf(p) === "/", p.url());
    }
    await c.close();
  }

  section("A5 · 1280: bảng 'Khác' không hiện hàng 'Trang chủ KiN' (máy tính đã có mục ở thanh bên)");
  {
    const { c, p } = await open(S, 1280, "/student/viec-cua-toi", { h: 800 });
    await p.getByRole("navigation", { name: railName }).first().waitFor({ timeout: 120000 });
    await p.getByRole("navigation", { name: railName }).first().getByRole("button", { name: /^Khác/ }).click();
    const dm = p.getByRole("dialog", { name: "Các mục khác" });
    await dm.waitFor({ timeout: 15000 });
    check(`1280: bảng Khác có ${MORE_EXPECT.length} liên kết nhìn thấy (theo cờ), 'Trang chủ KiN' có trong DOM nhưng ẨN`, (await dm.getByRole("link").count()) === MORE_EXPECT.length && (await dm.locator("[data-more-home]").count()) === 1 && !(await dm.locator("[data-more-home]").isVisible()));
    await c.close();
  }

  section("A6 · phòng thi /student/thi-thu/<mã đề>: KHÔNG có lối về (không vỏ) — không đổi");
  {
    const { c, p } = await open(S, 1280, `/student/thi-thu/${exam.id}`, { h: 800 });
    await p.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(1500);
    check("phòng thi: không thanh module, không [data-mobile-home], không [data-top-home], không liên kết 'Trang chủ' nào", (await p.getByRole("navigation", { name: railName }).count()) === 0 && (await p.locator("[data-mobile-home], [data-top-home], [data-rail-home], [data-more-home]").count()) === 0 && (await p.getByRole("link", { name: /Trang chủ/ }).count()) === 0, p.url());
    await c.close();
  }

  // ═════════════════════════ B. "/" cho học sinh đã đăng nhập, theo vai ═════════════════════════
  section("B1 · '/' mở được với học sinh đã đăng nhập (1600 / 1280): ở lại '/', có khối 'Lớp của tôi', 'Vào trang của tôi' → Việc của tôi, 'Lớp của tôi' trong Navbar → /student/hoc-tap");
  for (const w of [1600, 1280]) {
    const { c, p } = await open(S, w, "/");
    await homeReady(p);
    await p.waitForTimeout(3000);
    check(`${w}px: sau 3 giây URL vẫn là '/' (KHÔNG bị ép sang /student)`, pathOf(p) === "/", p.url());
    await waitState(p, "my-class", "ok", 60000);
    const blk = p.locator('[data-home-block="my-class"]');
    check(`${w}px: khối 'Lớp của tôi' hiện đúng 1 hàng lớp (Toán 9 trang chủ), đếm '1/2 bài đã hoàn thành'`, (await blk.locator("[data-home-class-row]").count()) === 1 && /Toán 9 trang chủ/.test(await blk.innerText()) && /1\/2 bài đã hoàn thành/.test(await blk.innerText()), await blk.innerText());
    const cta = blk.locator("[data-home-my-class-cta]");
    check(`${w}px: nút 'Vào Lớp của tôi' → /student/hoc-tap, cao ≥ 44px`, (await cta.getAttribute("href")) === "/student/hoc-tap" && (await h(cta)) >= 44);
    const go = p.locator("header").getByRole("link", { name: "Vào trang của tôi" });
    check(`${w}px: 'Vào trang của tôi' → /student/viec-cua-toi; Navbar có 'Lớp của tôi' → /student/hoc-tap (cuối, ≥ 44px)`, (await go.getAttribute("href")) === "/student/viec-cua-toi" && (await p.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link").allInnerTexts()).join("|") === NAV_STUDENT && (await p.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Lớp của tôi" }).getAttribute("href")) === "/student/hoc-tap");
    check(`${w}px: CTA cuối trang chủ ('Đăng ký') ẨN với học sinh đã đăng nhập`, (await p.locator("[data-home-cta-final]").count()) === 0);
    {
      const want = ["my-class", ...(CD ? ["community"] : []), ...(DC ? ["score"] : [])];
      check(`${w}px: khối theo cờ, đúng thứ tự DOM: ${want.join(" → ")}${QUIZ ? " + quiz" : ""}; khối của phần ẩn KHÔNG có (bảng tin ${CD ? "mở" : "ẩn"}, tính điểm ${DC ? "mở" : "ẩn"})`, await p.evaluate(`(() => { const all = [...document.querySelectorAll("[data-home-block]")].map(e => e.getAttribute("data-home-block")); const want = ${JSON.stringify(want)}; const o = want.map(b => all.indexOf(b)); return o.every((i, k) => i >= 0 && (k === 0 || o[k - 1] < i)) && all.includes("community") === ${CD} && all.includes("score") === ${DC} && all.includes("quiz") === ${QUIZ}; })()`) as boolean);
    }
    if (w === 1280) await shot(p, "home-student-1280");
    await p.locator('[data-home-class-row] a').first().click();
    await p.waitForURL(u => u.pathname === "/student/hoc-tap", { timeout: 120000 });
    check(`${w}px: bấm hàng lớp → /student/hoc-tap?course=<id>`, new URL(p.url()).searchParams.get("course") === C1.id, p.url());
    await c.close();
  }
  section("B2 · học sinh 4 lớp: hiện 3 hàng + liên kết 'Xem tất cả 4 lớp'");
  {
    const { c, p } = await open(SM, 1280, "/");
    await homeReady(p); await waitState(p, "my-class", "ok", 60000);
    const blk = p.locator('[data-home-block="my-class"]');
    const more = blk.getByRole("link", { name: /Xem tất cả 4 lớp/ });
    check("3 hàng lớp + 'Xem tất cả 4 lớp →' /student/hoc-tap, cao ≥ 44px", (await blk.locator("[data-home-class-row]").count()) === 3 && (await more.getAttribute("href")) === "/student/hoc-tap" && (await h(more)) >= 44);
    await c.close();
  }
  section("B3 · khối theo vai: khách, gia sư, gia sư chờ duyệt, quản trị KHÔNG thấy 'Lớp của tôi' (cả khối lẫn mục Navbar); CTA cuối: khách thấy, mọi vai đăng nhập không");
  for (const [name, u, cta] of [["khách", null, true], ["gia sư", T, false], ["gia sư chờ duyệt", TP, false], ["quản trị", A, false]] as const) {
    const { c, p } = await open(u, 1280, "/");
    await homeReady(p);
    if (u) await p.locator("header").getByRole("link", { name: "Vào trang của tôi" }).waitFor({ timeout: 90000 });
    await p.waitForTimeout(1500);
    check(`${name}: URL '/', không khối 'Lớp của tôi', không mục 'Lớp của tôi' ở Navbar, Navbar đúng 4 mục`, pathOf(p) === "/" && (await p.locator('[data-home-block="my-class"]').count()) === 0 && (await p.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link").allInnerTexts()).join("|") === NAV_GUEST && (await p.getByText("Lớp của tôi", { exact: true }).count()) === 0);
    check(`${name}: CTA cuối ${cta ? "CÓ" : "ẨN"}`, (await p.locator("[data-home-cta-final]").count()) === (cta ? 1 : 0));
    check(`${name}: bảng tin ${CD ? "có" : "ẩn"}, quiz ${QUIZ ? "có" : "ẩn"}, tính điểm ${DC ? "có" : "ẩn"} (theo cờ)`, (await p.locator('[data-home-block="community"]').count()) === (CD ? 1 : 0) && (await p.locator('[data-home-block="quiz"]').count()) === (QUIZ ? 1 : 0) && (await p.locator('[data-home-block="score"]').count()) === (DC ? 1 : 0));
    if (!u) {
      check("khách: có 'Đăng nhập' và 'Đăng ký' ở header, không 'Vào trang của tôi'", await p.locator("header").getByRole("link", { name: "Đăng nhập", exact: true }).isVisible() && await p.locator("header").getByRole("link", { name: "Đăng ký", exact: true }).isVisible() && (await p.getByRole("link", { name: "Vào trang của tôi" }).count()) === 0);
      const hero = await p.evaluate(`Math.round(document.querySelector("main section").getBoundingClientRect().height)`) as number;
      check(`khách 1280: Hero gọn cao ≤ 440px (đo được ${hero}px)`, hero <= 440, hero);
      await shot(p, "home-guest-1280");
    }
    await c.close();
  }

  // ═════════════════════════ C. Ba trạng thái từng khối ═════════════════════════
  section("C1 · 'Lớp của tôi': đang tải (khung xương aria-busy) → xong; rỗng (đúng chữ + 2 nút); lỗi (nói là LỖI + 'Thử lại' bấm được)");
  {
    // đang tải
    const { c, p } = await open(S, 1280, "/", { setup: async pg => { await pg.route("**/api/enrollments**", async r => { await new Promise(x => setTimeout(x, 3000)); await r.continue(); }); } });
    await homeReady(p, false);
    await waitState(p, "my-class", "loading", 40000);
    const sk = p.locator('[data-home-block="my-class"] [data-home-skeleton]');
    check("đang tải: có khung xương role=status aria-busy=true, nhãn 'Đang tải Lớp của tôi'", (await sk.getAttribute("aria-busy")) === "true" && (await sk.getAttribute("role")) === "status" && (await sk.getAttribute("aria-label")) === "Đang tải Lớp của tôi");
    await waitState(p, "my-class", "ok", 60000);
    check("tải xong: khung xương biến mất, hàng lớp hiện", (await p.locator('[data-home-block="my-class"] [data-home-skeleton]').count()) === 0 && (await p.locator("[data-home-class-row]").count()) === 1);
    await c.close();
  }
  {
    const { c, p } = await open(S0, 1280, "/");
    await homeReady(p); await waitState(p, "my-class", "empty", 60000);
    const blk = p.locator('[data-home-block="my-class"]');
    const t = await blk.innerText();
    check("rỗng: 'Bạn chưa vào lớp nào' + lời giải thích; nút 'Nhập mã lớp' → /student/nhap-ma-lop, 'Tìm lớp miễn phí' → /khoa-hoc?gia=free (≥ 44px)", /Bạn chưa vào lớp nào/.test(t) && /Gia sư sẽ gửi cho bạn mã mời/.test(t) && (await blk.getByRole("link", { name: "Nhập mã lớp" }).getAttribute("href")) === "/student/nhap-ma-lop" && (await blk.getByRole("link", { name: "Tìm lớp miễn phí" }).getAttribute("href")) === "/khoa-hoc?gia=free" && (await h(blk.getByRole("link", { name: "Nhập mã lớp" }))) >= 44 && (await h(blk.getByRole("link", { name: "Tìm lớp miễn phí" }))) >= 44, t);
    check("rỗng: không có nút 'Vào Lớp của tôi', không hiện như lỗi", (await blk.locator("[data-home-my-class-cta]").count()) === 0 && !/Không tải được/.test(t));
    await shot(p, "home-student-rong-1280");
    await c.close();
  }
  {
    let broken = true;
    const { c, p } = await open(S, 1280, "/", { setup: async pg => { await pg.route("**/api/enrollments**", r => broken ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.continue()); } });
    await homeReady(p); await waitState(p, "my-class", "error", 60000);
    const blk = p.locator('[data-home-block="my-class"]');
    check("lỗi: 'Không tải được danh sách lớp của bạn.' (không nói là 'chưa vào lớp nào')", /Không tải được danh sách lớp của bạn\./.test(await blk.innerText()) && !/Bạn chưa vào lớp nào/.test(await blk.innerText()));
    const retry = blk.getByRole("button", { name: "Thử lại" });
    check("lỗi: nút 'Thử lại' cao ≥ 44px", (await h(retry)) >= 44);
    broken = false;
    await retry.click();
    await waitState(p, "my-class", "ok", 60000);
    check("bấm 'Thử lại' khi mạng đã ổn → hiện lớp", (await p.locator("[data-home-class-row]").count()) === 1);
    await c.close();
  }

  if (!CD) {
    section("C2/C3/D · bảng tin ẨN (cờ CONG_DONG tắt): không khối bảng tin, không quiz, không gọi /api/community/feed, không lối vào /cong-dong");
    for (const [name, u] of [["khách", null], ["học sinh", S]] as const) {
      const feedReqs: string[] = [];
      const { c, p } = await open(u, 1280, "/", { setup: async pg => { pg.on("request", r => { if (/\/api\/community\/feed/.test(r.url())) feedReqs.push(r.url()); }); } });
      await homeReady(p);
      if (u) await waitState(p, "my-class", "ok", 60000);
      await p.waitForTimeout(1500);
      check(`${name}: không khối bảng tin / quiz, không thẻ bài, không gọi API bảng tin, không liên kết /cong-dong`, (await p.locator('[data-home-block="community"], [data-home-block="quiz"], [data-feed-card]').count()) === 0 && feedReqs.length === 0 && (await p.locator('main a[href^="/cong-dong"], header a[href^="/cong-dong"]').count()) === 0, feedReqs);
      await c.close();
    }
  } else {
    section("C2 · bảng tin: đang tải · rỗng · lỗi 500 · mất mạng (+ 'Thử lại')");
    {
      const { c, p } = await open(null, 1280, "/", { setup: async pg => { await pg.route("**/api/community/feed**", async r => { await new Promise(x => setTimeout(x, 3000)); await r.continue(); }); } });
      await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 });
      await waitState(p, "community", "loading", 40000);
      const sk = p.locator('[data-home-block="community"] [data-home-skeleton]');
      check("đang tải: khung xám role=status aria-busy=true, nhãn 'Đang tải bảng tin'", (await sk.getAttribute("aria-busy")) === "true" && (await sk.getAttribute("aria-label")) === "Đang tải bảng tin");
      await waitState(p, "community", "ok", 60000);
      check("tải xong: khung xám biến mất, có thẻ bài", (await p.locator('[data-home-block="community"] [data-home-skeleton]').count()) === 0 && (await p.locator("[data-feed-card]").count()) > 0);
      await c.close();
    }
    {
      const { c, p } = await open(null, 1280, "/", { setup: async pg => { await pg.route("**/api/community/feed**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pinned: [], items: [] }) })); } });
      await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 }); await waitState(p, "community", "empty", 60000);
      const blk = p.locator('[data-home-block="community"]');
      const open1 = blk.getByRole("link", { name: "Mở Cộng đồng" });
      check("rỗng: 'Chưa có bài viết nào.' + lời giải thích + nút 'Mở Cộng đồng' → /cong-dong (≥ 44px); không thẻ bài", /Chưa có bài viết nào\./.test(await blk.innerText()) && /Khi gia sư hoặc các bạn đăng bài/.test(await blk.innerText()) && (await open1.getAttribute("href")) === "/cong-dong" && (await h(open1)) >= 44 && (await p.locator("[data-feed-card]").count()) === 0);
      await c.close();
    }
    for (const [kind, fulfill] of [["500", true], ["mất mạng", false]] as const) {
      let broken = true;
      const { c, p } = await open(null, 1280, "/", { setup: async pg => { await pg.route("**/api/community/feed**", r => broken ? (fulfill ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : r.abort("failed")) : r.continue()); } });
      await p.getByRole("heading", { level: 1 }).waitFor({ timeout: 120000 }); await waitState(p, "community", "error", 60000);
      const blk = p.locator('[data-home-block="community"]');
      const t = await blk.innerText();
      check(`lỗi (${kind}): 'Không tải được bảng tin' + kicker 'Lỗi · Có thể thử lại'${fulfill ? "" : " + chữ 'Mất kết nối mạng'"}`, /Không tải được bảng tin/.test(t) && /Lỗi · Có thể thử lại/i.test(t) && (fulfill || /Mất kết nối mạng/.test(t)), t);
      const retry = blk.getByRole("button", { name: "Thử lại" });
      check(`lỗi (${kind}): 'Thử lại' cao ≥ 44px`, (await h(retry)) >= 44);
      broken = false;
      await retry.click();
      await waitState(p, "community", "ok", 60000);
      check(`lỗi (${kind}): 'Thử lại' khi mạng ổn → hiện bài`, (await p.locator("[data-feed-card]").count()) > 0);
      await c.close();
    }

    section("C3 · quiz: HIỆN mặc định ở trạng thái rỗng đúng chữ + nút 'Làm đề thi thử' → /thi-thu (đang tải / lỗi của quiz: N/A — chưa có nguồn dữ liệu để gây ra)");
    {
      const { c, p } = await open(null, 1280, "/");
      await homeReady(p);
      const q = p.locator('[data-home-block="quiz"]');
      await q.waitFor({ timeout: 30000 });
      const btn = q.getByRole("link", { name: "Làm đề thi thử" });
      check("quiz: state=empty, 'Chưa có quiz nào được đăng.', nút → /thi-thu cao ≥ 44px, không có mục quiz giả", (await q.getAttribute("data-home-state")) === "empty" && /Chưa có quiz nào được đăng\./.test(await q.innerText()) && (await btn.getAttribute("href")) === "/thi-thu" && (await h(btn)) >= 44 && (await q.locator("[data-home-quiz-item]").count()) === 0);
      check("quiz: không lộ đáp án / điểm / thứ hạng / 'người đã làm' trong khối", !/đáp án|giải thích|điểm số|thứ hạng|người đã làm|xếp hạng/i.test(await q.innerText()));
      await c.close();
    }

    // ═════════════════════════ D. Bảng tin: nội dung riêng tư, nhắn riêng, tương tác ═════════════════════════
    section("D · bảng tin (khách và học sinh): ≤ 5 thẻ, chỉ bài chung, tên rút gọn, không trường / lớp / họ tên đầy đủ, không nhắn riêng; Thích → đăng nhập; 'Xem tất cả' → /cong-dong");
    for (const [name, u] of [["khách", null], ["học sinh trong lớp", S]] as const) {
      const { c, p } = await open(u, 1280, "/");
      await homeReady(p); await waitState(p, "community", "ok", 60000);
      const blk = p.locator('[data-home-block="community"]');
      const txt = await blk.innerText();
      const all = await p.locator("body").innerText();
      const cards = await blk.locator("[data-feed-card]").count();
      check(`${name}: 1 ≤ thẻ bài ≤ 5 (${cards})`, cards >= 1 && cards <= 5);
      check(`${name}: KHÔNG có bài riêng của lớp, KHÔNG có bài chờ duyệt`, !all.includes(CLASS_ONLY) && !all.includes(`BAI-CHO-DUYET-${stamp}`));
      check(`${name}: không có họ tên đầy đủ '${FULL_NAME}', tên trường, thành phố, số điện thoại trên trang`, !all.includes(FULL_NAME) && !all.includes(SCHOOL) && !all.includes("Thành Phố Bí Mật") && !all.includes("0912345678") && !all.includes("0987654321"));
      check(`${name}: tên tác giả đã rút gọn ('Anh N.') và tên gia sư hiện ở dạng nhãn`, /Anh N\./.test(txt));
      check(`${name}: không có nút / liên kết nhắn riêng ('nhắn tin', 'tin nhắn', 'gửi tin', 'inbox') và không liên kết /tin-nhan, /messages trong khối`, !/nhắn tin|tin nhắn|nhắn riêng|gửi tin|inbox/i.test(txt) && (await blk.locator('a[href*="tin-nhan"], a[href*="message"], a[href*="inbox"]').count()) === 0);
      check(`${name}: không có ô soạn bài / ô hỏi trong khối (không textarea, không nút 'Đăng bài' / 'Đặt câu hỏi')`, (await blk.locator("textarea").count()) === 0 && !/Đăng bài|Đặt câu hỏi|Viết bài|Soạn bài/.test(txt));
      const feedAll = blk.locator("[data-home-feed-all]");
      check(`${name}: 'Xem tất cả bài viết' → /cong-dong, cao ≥ 44px`, (await feedAll.getAttribute("href")) === "/cong-dong" && (await h(feedAll)) >= 44);
      if (!u) {
        await blk.locator('button[data-act="like"]').first().click();
        await p.waitForURL(/\/dang-nhap/, { timeout: 60000 });
        check("khách bấm 'Thích' → /dang-nhap?redirect=%2F", /redirect=%2F(&|$)/.test(p.url()) || new URL(p.url()).searchParams.get("redirect") === "/", p.url());
      } else {
        const like = blk.locator('button[data-act="like"]').first();
        const before = await like.getAttribute("aria-pressed");
        check("học sinh: nút Thích / Lưu là nút thật (aria-pressed), cao ≥ 44px", before === "false" && (await h(like)) >= 44);
        // bài của chính mình không có Báo cáo; của người khác có
        check("học sinh: bài của người khác có nút 'Báo cáo'", (await blk.locator('button[data-act="report"]').count()) >= 1);
      }
      await c.close();
    }
    {
      const { c, p } = await open(null, 1280, "/");
      await homeReady(p); await waitState(p, "community", "ok", 60000);
      await p.locator("[data-home-feed-all]").click();
      await p.waitForURL(u => u.pathname === "/cong-dong", { timeout: 120000 });
      check("bấm 'Xem tất cả bài viết' → /cong-dong", pathOf(p) === "/cong-dong");
      await c.close();
    }
  }

  // ═════════════════════════ E. Tính điểm ═════════════════════════
  if (!DC) {
    section("E · tính điểm ẨN (cờ DIEM_CHUAN tắt): không khối tính điểm, không thẻ dẫn /diem-chuan");
    const { c, p } = await open(null, 1280, "/");
    await homeReady(p);
    check("không [data-home-block=score], không [data-score-calc], không liên kết /diem-chuan trong thân trang", (await p.locator('[data-home-block="score"], [data-score-calc]').count()) === 0 && (await p.locator('main a[href^="/diem-chuan"]').count()) === 0);
    await c.close();
  } else {
    section("E · tính điểm: nhập điểm → kết quả đúng (24,94 / 30); KHÔNG có request nào phát sinh khi bấm; lưu ý thường trực; không công thức → thẻ dẫn /diem-chuan");
    {
      const { c, p } = await open(null, 1280, "/");
      await homeReady(p);
      const calc = p.locator("[data-score-calc]");
      await calc.waitFor({ timeout: 60000 });
      check("khối tính điểm state=ok; lưu ý 'Chỉ mang tính tham khảo. KiN không lưu điểm bạn nhập.' hiện NGAY (trước khi tính)", (await blockState(p, "score")) === "ok" && /Chỉ mang tính tham khảo/.test(await calc.locator("[data-calc-disclaimer]").innerText()) && /KiN không lưu điểm bạn nhập/.test(await calc.locator("[data-calc-disclaimer]").innerText()));
      await calc.locator("#tc-m1").fill("8,5"); await calc.locator("#tc-m2").fill("7.25"); await calc.locator("#tc-m3").fill("9");
      await p.waitForTimeout(800);
      const reqs: string[] = [];
      const bodies: string[] = [];
      p.on("request", r => { if (!r.url().startsWith("data:")) { reqs.push(`${r.method()} ${r.url()}`); const b = r.postData(); if (b) bodies.push(b); } });
      await calc.getByRole("button", { name: "Tính điểm" }).click();
      await calc.locator("[data-calc-result]").waitFor({ timeout: 15000 });
      await p.waitForTimeout(1500);
      const rt = await calc.locator("[data-calc-result]").innerText();
      check("Toán 8,5 + Lý 7,25 + Hoá 9 → 24,94 / 30 kèm lời giải từng bước", /24,94/.test(rt) && /\/ 30/.test(rt) && /Toán: 8,5 × 2 = 17/.test(rt), rt);
      check("KHÔNG có yêu cầu mạng nào khi bấm 'Tính điểm' (đếm mọi request trong 1,5 giây sau khi bấm)", reqs.length === 0, reqs);
      check("điểm đã nhập không nằm trong bất kỳ thân yêu cầu nào", bodies.every(b => !/8,5|7\.25/.test(b)) && reqs.every(r => !/8,5|7\.25|8\.5/.test(r)));
      check("kết quả KÈM câu lưu ý 'chỉ mang tính tham khảo'; ô bấm 'Tính điểm' / 'Xoá nhập' cao ≥ 44px", /chỉ mang tính tham khảo/.test(await calc.locator("[data-calc-result-note]").innerText()) && (await h(calc.getByRole("button", { name: "Tính điểm" }))) >= 44 && (await h(calc.getByRole("button", { name: "Xoá nhập" }))) >= 44);
      await shot(p, "home-guest-tinh-diem-1280");
      await c.close();
    }
    {
      await prisma.admissionFormula.delete({ where: { id: formula.id } });
      const { c, p } = await open(null, 1280, "/");
      await homeReady(p);
      const sc = p.locator('[data-home-block="score"]');
      await sc.waitFor({ timeout: 30000 });
      const btn = sc.getByRole("link", { name: "Mở Tra cứu điểm chuẩn" });
      check("không có công thức công khai: state=empty, thẻ 'Tra cứu điểm chuẩn' + câu nói thật + nút → /diem-chuan (≥ 44px); không form tính điểm", (await blockState(p, "score")) === "empty" && /KiN chưa có công thức tính điểm nào được công khai/.test(await sc.innerText()) && (await btn.getAttribute("href")) === "/diem-chuan" && (await h(btn)) >= 44 && (await p.locator("[data-score-calc]").count()) === 0);
      await c.close();
      await prisma.admissionFormula.create({ data: { id: formula.id, name: formula.name, school: formula.school, year: formula.year, scale: formula.scale, inputs: formula.inputs as object, multiplier: formula.multiplier, bonuses: formula.bonuses as object, sourceUrl: formula.sourceUrl, sourceName: formula.sourceName, verified: false, published: true } });
    }
  }

  // ═════════════════════════ F. Kích thước chạm, tràn ngang, chữ 130% ═════════════════════════
  for (const w of [1600, 1280, 390, 320]) {
    section(`F · ${w}px: mọi nút / liên kết nhìn thấy cao ≥ 44px (thân trang; thanh trên), không tràn ngang, chữ 130% không tràn`);
    for (const [name, u] of [["khách", null], ["học sinh", S]] as const) {
      const { c, p } = await open(u, w, "/", { h: 900 });
      await homeReady(p);
      if (u) await waitState(p, "my-class", "ok", 60000);
      if (CD) await waitState(p, "community", "ok", 60000);
      await p.waitForTimeout(800);
      const smAll = await small(p, "main"), smHead = await small(p, "header");
      const smMain = smAll.filter(x => !x.startsWith("[thẻ bài]")), smCard = smAll.filter(x => x.startsWith("[thẻ bài]"));
      check(`${name} ${w}px: không nút / liên kết nào cao < 44px trong THÂN trang (ngoài thẻ bài)`, smMain.length === 0, smMain.slice(0, 8));
      // FeedCard (src/components/community/FeedCard.tsx:30,39,42, dùng chung /cong-dong, KHÔNG đổi ở nhánh này): giờ đăng, tên tác giả, nội dung bài là liên kết chữ 18–21px.
      check(`${name} ${w}px: liên kết chữ TRONG thẻ bài (giờ đăng / tác giả / nội dung) cao ≥ 44px`, smCard.length === 0, smCard.slice(0, 8));
      check(`${name} ${w}px: không nút / liên kết nào cao < 44px trong THANH TRÊN (Navbar)`, smHead.length === 0, smHead.slice(0, 8));
      check(`${name} ${w}px: không tràn ngang`, await p.evaluate(NOT_OVERFLOW) as boolean);
      await p.addStyleTag({ content: "html{font-size:130% !important}" });
      await p.waitForTimeout(400);
      check(`${name} ${w}px: chữ phóng 130% vẫn không tràn ngang`, await p.evaluate(NOT_OVERFLOW) as boolean, await p.evaluate(`document.documentElement.scrollWidth + " > " + innerWidth`));
      if (w === 390) await shot(p, `home-${u ? "student" : "guest"}-390`);
      if (w === 1280 && !u) { const fs = await small(p, "footer"); check("[thông tin] chân trang 1280: số liên kết cao < 44px (ghi nhận, không tính lỗi của việc này)", true, fs.slice(0, 6)); console.log("     footer < 44px:", JSON.stringify(fs.slice(0, 8))); }
      await c.close();
    }
  }

  // ═════════════════════════ G. Trang vẫn tĩnh ═════════════════════════
  section("G · trang chủ vẫn TĨNH: HTML khách và HTML kèm cookie học sinh giống hệt (không đọc cookie ở máy chủ); khối 'Lớp của tôi' không có trong HTML máy chủ");
  {
    const norm = (s: string) => s.replace(/\s+/g, " ").replace(/"[a-f0-9]{8,}"/g, '""').replace(/nonce="[^"]*"/g, "").replace(/__next_r="[^"]*"/g, "").replace(/\bdata-precedence="[^"]*"/g, "");
    const g1 = await fetch(`${BASE}/`); const gt = await g1.text();
    const s1 = await fetch(`${BASE}/`, { headers: { cookie: await cookieFor(S) } }); const st = await s1.text();
    check("khách 200 có <h1>; học sinh 200", g1.status === 200 && s1.status === 200 && /<h1/.test(gt));
    check("thân HTML của khách = thân HTML của học sinh (cùng độ dài, cùng nội dung sau khi bỏ chuỗi băm)", norm(gt) === norm(st), [gt.length, st.length]);
    check("HTML máy chủ không có khối 'Lớp của tôi' cho học sinh (data-home-block=\"my-class\") và không có tên học sinh", !/data-home-block="my-class"/.test(st) && !st.includes("Minh Anh"));
    check("HTML có sẵn CTA cuối + Hero + 'Học ở đây thì được gì?' (bản của khách) để SEO", /data-home-cta-final/.test(gt) && /Học ở đây thì được gì/.test(gt));
    const cc = g1.headers.get("cache-control") ?? "";
    console.log(`     [thông tin] Cache-Control của '/' ở next dev = "${cc}" (s-maxage chỉ có ở bản dựng production — KHÔNG kiểm được ở máy dev; trang không gọi cookies()/headers() được t-no-fabricated khoá bằng đọc mã)`);
    check("HTML không nhúng đáp án (isCorrect / answerKey / explanation / \"correct\")", !/isCorrect|answerKey|explanation|"correct"/.test(gt));
  }

  // ═════════════════════════ H. Mô hình kẻ tấn công miền học sinh ═════════════════════════
  section("H1 · học sinh mở route gia sư / quản trị → bị chuyển đi, không có đường quay về mới mở ra");
  {
    const c = await ctxFor(S, { width: 1280, height: 800, rail: "mo" });
    for (const path of ["/lop-cua-toi/lich", "/lop-cua-toi/hoc-sinh", "/lop-cua-toi/doanh-thu", "/lop-cua-toi/cho-duyet", "/lop-cua-toi/de-thi", "/admin", "/admin/hoc-sinh", "/admin/khoa-hoc"]) {
      const p = await c.newPage(); watch(p);
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 }).catch(() => {});
      await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(1200);
      const r = await p.evaluate(`({ url: location.pathname, tutorRail: !!document.querySelector('nav[aria-label="Module của gia sư"]'), adminRail: !!document.querySelector('nav[aria-label="Module quản trị"]'), h1: (document.querySelector('h1')||{}).textContent || '', adminLinks: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /^\\/admin(\\/|$)|\\/\\/admin\\./.test(h)).length })`) as any;
      check(`${path}: học sinh không vào được (đích '${r.url}'), không thấy vỏ gia sư / quản trị, không có liên kết /admin nào trong trang đích`, !/^\/admin/.test(r.url) && !r.tutorRail && !r.adminRail && r.adminLinks === 0 && !/Doanh thu|Quản trị viên|Gói KiN Pro/.test(r.h1), r);
      await p.close();
    }
    await c.close();
  }
  section("H2 · khách mở /student/* → /dang-nhap?redirect= đúng trang; trang chủ không có đường vào khu học sinh cho khách");
  {
    const c = await ctxFor(null, { width: 1280, height: 800 });
    for (const path of ["/student/viec-cua-toi", "/student/lich-hoc", "/student/hoc-tap", `/student/hoc-tap?course=${C1.id}`, "/student/ho-so", `/student/bai-giang/${lid}`]) {
      const p = await c.newPage(); watch(p);
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
      await p.waitForURL(/\/dang-nhap/, { timeout: 90000 });
      const rd = new URL(p.url()).searchParams.get("redirect");
      // `?course=` bị bỏ khỏi redirect (chỉ giữ đường dẫn) — có sẵn từ AuthGuard, không do BU-HS-TRANG-CHU; ghi nhận, không tính đỏ.
      const want = path.split("?")[0];
      check(`${path} → /dang-nhap?redirect=${rd}`, pathOf(p) === "/dang-nhap" && rd === want, p.url());
      if (path.includes("?") && rd === want) console.log("     [thông tin, có sẵn] redirect bỏ phần ?course= — vào lại sau đăng nhập về danh mục lớp, không về đúng lớp");
      await p.close();
    }
    const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240000 }); await homeReady(p);
    const hrefs = await p.evaluate(`[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))`) as string[];
    check("trang chủ của khách: không liên kết nào vào /student/, /admin, /lop-cua-toi/ (chỉ qua đăng nhập)", hrefs.every(x => !/^\/(student|admin|lop-cua-toi)(\/|$)/.test(x) || x === "/student/dang-ky"), hrefs.filter(x => /^\/(student|admin|lop-cua-toi)/.test(x)));
    await c.close();
  }
  section("H3 · API: JSON bảng tin không lộ trường riêng tư (khách và học sinh); API học sinh với khách; quiz không có dữ liệu → N/A");
  {
    const FEED = "/api/community/feed?tab=all&scope=common&limit=5";
    for (const [name, as] of [["khách", undefined], ["học sinh", S], ["học sinh khác lớp", S0]] as const) {
      const r = await api("GET", FEED, { as });
      const items = [...(r.json?.pinned ?? []), ...(r.json?.items ?? [])];
      check(`${name}: 200, ≤ 5 mục, không khoá riêng tư nào (đệ quy: email, phone, school, city, dateOfBirth, guestIpHash, reviewedById, rejectReason, password, correct, isCorrect, answerKey, explanation)`, r.status === 200 && r.json?.items?.length <= 5 && keysIn(r.json).length === 0, keysIn(r.json));
      check(`${name}: không chuỗi riêng tư trong thân (họ tên đầy đủ, trường, thành phố, số điện thoại, bài lớp, bài chờ duyệt)`, ![FULL_NAME, SCHOOL, "Thành Phố Bí Mật", "0912345678", "0987654321", CLASS_ONLY, `BAI-CHO-DUYET-${stamp}`, "u1-", "@test.local"].some(s => r.text.includes(s)), r.text.slice(0, 200));
      check(`${name}: mọi mục không có 'course', author chỉ gồm {id,label,tag,href}, isOwn/likedByMe/bookmarkedByMe = false`, items.every(i => i.course === null && Object.keys(i.author).sort().join(",") === "href,id,label,tag" && i.isOwn === false && i.likedByMe === false && i.bookmarkedByMe === false), items[0]?.author);
    }
    const e1 = await api("GET", "/api/enrollments?detail=1"), pr = await api("GET", "/api/progress"), vt = await api("GET", "/api/student/viec-cua-toi");
    check("khách: /api/enrollments?detail=1 và /api/progress trả RỖNG (200, không dữ liệu của ai), /api/student/viec-cua-toi → 401", e1.status === 200 && (e1.json?.courseIds ?? []).length === 0 && (e1.json?.courses ?? []).length === 0 && pr.status === 200 && (pr.json?.completedIds ?? []).length === 0 && vt.status === 401, [e1.status, pr.status, vt.status]);
    const pt = await api("POST", "/api/community/threads", { body: { content: "khách thử đăng từ trang chủ", category: "kinh-nghiem" } });
    check("khách: POST /api/community/threads → 401 (không đăng được từ trang chủ)", pt.status === 401, [pt.status, pt.json]);
    const sq = await api("GET", "/api/tutor/quiz", { as: S }), sq2 = await api("GET", "/api/tutor/quiz");
    check("quiz: API gia sư /api/tutor/quiz đóng với học sinh và khách (401 / 403)", [401, 403].includes(sq.status) && [401, 403].includes(sq2.status), [sq.status, sq2.status]);
    console.log("     [N/A] khối Quiz không có API / dữ liệu công khai (spec 1.2): không có JSON quiz để quét đáp án — chỉ quét được HTML (ca G) và chữ trong khối (ca C3).");
    // học sinh KHÔNG đọc được tiến độ / lớp của học sinh khác qua API dùng cho trang chủ
    const eS = await api("GET", "/api/enrollments?detail=1", { as: S }), eM = await api("GET", "/api/enrollments?detail=1", { as: SM });
    check("học sinh chỉ thấy lớp của CHÍNH mình: S 1 lớp, SM 4 lớp, không lẫn", (eS.json?.courses ?? []).length === 1 && eS.json.courses[0].id === C1.id && (eM.json?.courses ?? []).length === 4 && !eM.text.includes(C1.id), [eS.json?.courses?.length, eM.json?.courses?.length]);
  }

  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 6));
  await Promise.race([closeAll(), new Promise(r => setTimeout(r, 15000))]);
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
