// DG-HOC-ONLINE — trình duyệt thật: gia sư vào lớp → Cài đặt → "Học online", dán link Google Meet, chọn "Trước 1 giờ", Lưu (POST + 303),
// F5 vẫn còn giá trị; link sai ⇒ báo lỗi, không lưu; 1600 và 390 không tràn ngang, nút ≥ 44px. Học sinh của lớp thấy "Mở link học online" đúng link đó.
// Chạy (máy chủ dev đang chạy): TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/ui-hoc-online.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, kinSelect, kinSelectValue, type Page } from "./ui";
import { prisma } from "@/lib/prisma";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Hà"), S = await mkUser({ name: "Em Học Online" });
  const C = await mkCourse(T.id, { name: "Toán 8 Online" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const tomorrow = addDaysKey(vnDateKeyOf(new Date()), 1);
  await prisma.classSchedule.create({ data: { courseId: C.id, dayOfWeek: dayOfWeekOfKey(tomorrow), startTime: "19:00", endTime: "20:30", mode: "online" } });
  const url = `${BASE}/lop-cua-toi/quan-lop/${C.id}?tab=cai-dat&muc=hoc-online`;

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|font|Hydration|negative time stamp/i.test(m.text())) errors.push(m.text()); });
  };

  let lastLink = "";
  for (const [W, H, tag] of [[1600, 1000, "1600"], [390, 844, "390"]] as const) {
    section(`Gia sư · ${tag}px`);
    const link = `https://meet.google.com/kin-${tag}-abc`;
    const ctx = await ctxFor(T, { width: W, height: H });
    const p = await ctx.newPage(); watch(p);
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
    const box = p.locator("[data-hoc-online]");
    await box.waitFor({ timeout: 120000 });
    check(`${tag}: mục "Học online" có trong dải mục Cài đặt và đang chọn`, (await p.getByRole("link", { name: "Học online" }).count()) >= 1);
    const chipIn = async () => p.evaluate(() => {
      const nav = document.querySelector("[data-muc-nav]"), el = document.querySelector('[data-muc="hoc-online"]');
      if (!nav || !el) return false;
      const a = nav.getBoundingClientRect(), b = el.getBoundingClientRect();
      return b.left >= a.left - 1 && b.right <= a.right + 1 && el.getAttribute("aria-current") === "page";
    });
    let inView = false;
    for (let i = 0; i < 30 && !(inView = await chipIn()); i++) await p.waitForTimeout(100);
    check(`${tag}: mục đang chọn "Học online" hiện trọn trong dải mục (tự cuộn ngang), trang không bị cuộn dọc`, inView && (await p.evaluate(() => window.scrollY)) === 0);
    const input = p.locator("#hoc-online-link");
    const combo = p.locator("#hoc-online-nhac");
    if (tag === "1600") {
      check(`${tag}: lần đầu ô link trống, nhắc = Tắt`, (await input.inputValue()) === "" && (await kinSelectValue(combo)) === "");
      // Link http ⇒ máy chủ từ chối (bắt buộc https), không lưu gì.
      await input.fill("http://meet.google.com/khong-ma-hoa");
      await Promise.all([p.waitForURL(/loi=link/, { timeout: 120000 }), p.locator("[data-hoc-online-luu]").click()]);
      await p.locator("[data-hoc-online-flash=link]").waitFor({ timeout: 60000 });
      const c0 = await prisma.course.findUnique({ where: { id: C.id }, select: { classJoinUrl: true, reminderLeadMinutes: true } });
      check(`${tag}: link http ⇒ báo "Link chưa đúng… Chưa lưu gì.", DB không đổi`, (await p.locator("[data-hoc-online-flash=link]").innerText()).includes("Chưa lưu gì") && c0?.classJoinUrl === null && c0?.reminderLeadMinutes === null);
    }
    await input.fill(link);
    await kinSelect(combo, { label: "Trước 1 giờ" });
    const resP = p.waitForResponse(r => r.url().includes(`/api/tutor/lop/${C.id}/hoc-online`) && r.request().method() === "POST", { timeout: 120000 });
    await Promise.all([p.waitForURL(/luu=ok/, { timeout: 120000 }), p.locator("[data-hoc-online-luu]").click()]);
    const res = await resP;
    check(`${tag}: Lưu = POST, máy chủ trả 303`, res.status() === 303, res.status());
    await p.locator("[data-hoc-online-flash=ok]").waitFor({ timeout: 60000 });
    check(`${tag}: báo "Đã lưu…" bằng chữ`, (await p.locator("[data-hoc-online-flash=ok]").innerText()).includes("Đã lưu"));
    const c1 = await prisma.course.findUnique({ where: { id: C.id }, select: { classJoinUrl: true, reminderLeadMinutes: true } });
    check(`${tag}: DB: classJoinUrl = link Meet, reminderLeadMinutes = 60`, c1?.classJoinUrl === link && c1?.reminderLeadMinutes === 60, c1);
    await p.reload({ waitUntil: "domcontentloaded", timeout: 240000 });
    await box.waitFor({ timeout: 120000 });
    check(`${tag}: F5 vẫn còn link và "Trước 1 giờ"`, (await input.inputValue()) === link && (await kinSelectValue(combo)) === "60" && (await combo.innerText()).includes("Trước 1 giờ"));
    check(`${tag}: không tràn ngang`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const small = await p.evaluate(() => [...document.querySelectorAll("[data-hoc-online] button, [data-hoc-online] input, [data-hoc-online] [role=combobox]")]
      .filter(e => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 43.5).map(e => `${e.tagName}:${Math.round(e.getBoundingClientRect().height)}`));
    check(`${tag}: nút / ô ≥ 44px`, small.length === 0, small);
    await shot(p, `hoc-online-${tag}`);
    lastLink = link;
    await ctx.close();
  }

  section("Tắt nhắc rồi bật lại vẫn lưu đúng");
  {
    const ctx = await ctxFor(T, { width: 1280, height: 900 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.locator("[data-hoc-online]").waitFor({ timeout: 120000 });
    await kinSelect(p.locator("#hoc-online-nhac"), { label: "Tắt" });
    await Promise.all([p.waitForURL(/luu=ok/, { timeout: 120000 }), p.locator("[data-hoc-online-luu]").click()]);
    await p.locator("[data-hoc-online-flash=ok]").waitFor({ timeout: 60000 });
    const c2 = await prisma.course.findUnique({ where: { id: C.id }, select: { classJoinUrl: true, reminderLeadMinutes: true } });
    check("chọn Tắt ⇒ reminderLeadMinutes null, link giữ nguyên", c2?.reminderLeadMinutes === null && c2?.classJoinUrl === lastLink, c2);
    await ctx.close();
  }

  section("Học sinh thấy nút vào học dùng đúng link");
  {
    const ctx = await ctxFor(S, { width: 390, height: 844 });
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${BASE}/student/hoc-tap?course=${C.id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await p.locator("[data-course-session]").first().waitFor({ timeout: 120000 });
    const join = p.locator("[data-course-session-join]").first();
    check("trang lớp của học sinh: 'Mở link học online' trỏ đúng link Meet gia sư vừa lưu, mở tab ngoài", (await join.count()) === 1 && (await join.getAttribute("href")) === lastLink && (await join.getAttribute("target")) === "_blank", await join.getAttribute("href").catch(() => null));
    check("390: trang học sinh không tràn ngang", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await ctx.close();
  }

  check("không lỗi JS trên trang", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
