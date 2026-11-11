// LOI-02 F (11/11/2026) — TRÌNH DUYỆT: số đỏ trên thanh module "Hộp việc" = số việc nhìn thấy ở "Cần cô xử lý", ở 1600 VÀ 390 (đặc tả LOI-02.md mục 2.F, 8).
// Tình huống của chủ: gia sư có 1 lớp "Lịch Sử - Tổng Ôn" đang nhận học viên, 1 em active chưa liên kết phụ huynh, 1 em pending_consent, KHÔNG khung giờ hằng tuần,
// máy chủ chạy cờ lịch TẮT (mặc định) ⇒ số đỏ không hiện (0), "Cần cô xử lý" rỗng, không có dòng nhắc "chưa có lịch học", em chờ phụ huynh nằm ở khối "Chờ phụ huynh".
// Đối chứng dương (để bài không xanh vì số đỏ KHÔNG BAO GIỜ hiện): thêm 1 yêu cầu xin vào lớp ⇒ số đỏ "1" ở đúng mục Hộp việc = "1 việc" = 1 dòng.
// H3 (1600): duyệt yêu cầu bằng fetch (không tải lại trang) rồi cửa sổ lấy lại focus ⇒ số đỏ về 0 mà không cần điều hướng (HopViec gọi router.refresh()).
// Chạy: TZ=Asia/Ho_Chi_Minh; source tools/local-e2e/env.sh && SHOTS=<thư mục ảnh> npx tsx tools/local-e2e/ui-loi-02-hop-viec.ts   (máy chủ thử ở BASE, cờ lịch tắt; bài gọi wipe()).
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

const RAIL = "Module của gia sư";
const SHOTS = process.env.SHOTS ?? "scratchpad/shots";

type Read = { navs: number; inboxItem: number; badges: { href: string | null; text: string }[]; aside: string | null; rows: number; rowSum: number; empty: boolean; noSched: boolean; waitText: string };

(async () => {
  if (process.env.NEXT_PUBLIC_KIN_MO_LICH === "1") console.log("  ! NEXT_PUBLIC_KIN_MO_LICH=1 trong tiến trình test — bài này giả định MÁY CHỦ chạy cờ tắt (mặc định).");
  await wipe();
  const TF = await mkTutor("Cô Sử");
  const SA = await mkUser({ name: "Em Đang Học" }), SB = await mkUser({ name: "Em Chờ Phụ Huynh" }), SC = await mkUser({ name: "Em Xin Vào" });
  const cSu = await mkCourse(TF.id, { name: "Lịch Sử - Tổng Ôn" });
  await prisma.enrollment.create({ data: { userId: SA.id, courseId: cSu.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: SB.id, courseId: cSu.id, status: "pending_consent" } });
  check("dữ liệu đúng tình huống của chủ: lớp mở, 0 khung giờ, 1 em active không phụ huynh, 1 em pending_consent",
    (await prisma.classSchedule.count({ where: { courseId: cSu.id } })) === 0 && (await prisma.parentLink.count({ where: { studentId: SA.id } })) === 0
    && (await prisma.enrollment.count({ where: { courseId: cSu.id, status: "active" } })) === 1 && (await prisma.enrollment.count({ where: { courseId: cSu.id, status: "pending_consent" } })) === 1
    && (await prisma.course.findUnique({ where: { id: cSu.id } }))?.classStatus === "open");

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => { if (!/negative time stamp/i.test(String(e))) errors.push(String(e)); });
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|hydrat|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
  };

  // Đọc trên trang đã tải xong Hộp việc: số đỏ trong thanh module ĐANG HIỆN (máy tính: thanh trái; điện thoại: thanh dưới) + số việc nhìn thấy.
  // Chuỗi script (không phải hàm): tsx/esbuild chèn __name vào hàm có tên lồng nhau, trình duyệt không có __name.
  const READ_JS = `(() => {
    const rail = ${JSON.stringify(RAIL)};
    function vis(e) { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }
    const navs = [...document.querySelectorAll('nav[aria-label="' + rail + '"]')].filter(vis);
    const inboxItem = navs.flatMap(n => [...n.querySelectorAll('a[href="/lop-cua-toi"]:not([data-rail-home])')]).filter(vis).length;
    const badges = navs.flatMap(n => [...n.querySelectorAll(".kin-badge-dem")]).filter(vis).map(b => ({ href: b.closest("a") ? b.closest("a").getAttribute("href") : null, text: (b.textContent || "").trim() }));
    const hv = document.getElementById("hv-todo");
    const head = hv ? hv.closest("section") : null;
    const asideEl = head ? [...head.querySelectorAll("*")].find(e => /^\\d+ việc$/.test((e.textContent || "").trim()) && e.children.length === 0) : null;
    const lis = [...document.querySelectorAll('ul[aria-label="Việc cần cô xử lý"] > li')].filter(vis);
    const rowSum = lis.reduce((s, li) => s + Number(((li.textContent || "").trim().match(/^\\d+/) || ["0"])[0]), 0);
    const body = document.body.innerText;
    const hw = document.getElementById("hv-wait");
    const wait = hw ? hw.closest("section") : null;
    return { navs: navs.length, inboxItem, badges, aside: asideEl ? (asideEl.textContent || "").trim() : null, rows: lis.length, rowSum,
      empty: body.includes("Không có việc nào đang chờ cô"), noSched: /chưa có lịch học/i.test(body), waitText: wait ? wait.innerText : "" };
  })()`;
  const read = (pg: any): Promise<Read> => pg.evaluate(READ_JS);
  const openInbox = async (pg: any) => {
    await pg.goto(`${BASE}/lop-cua-toi`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.locator("#hv-todo").first().waitFor({ timeout: 120000 });
    await pg.waitForTimeout(300);
  };
  const badgeNum = (r: Read) => r.badges.filter(b => b.href === "/lop-cua-toi").reduce((s, b) => s + (Number(b.text) || 0), 0);
  const visibleCount = (r: Read) => (r.aside ? Number(r.aside.match(/^\d+/)?.[0] ?? 0) : 0);

  for (const [W, H, tag] of [[1600, 1000, "1600"], [390, 844, "390"]] as const) {
    section(`Hộp việc · ${tag}px: số đỏ = số việc nhìn thấy (tình huống của chủ, cờ lịch tắt)`);
    const ctx = await ctxFor(TF, { width: W, height: H, rail: "mac-dinh" });
    const pg = await ctx.newPage(); watch(pg);
    await openInbox(pg);
    const r0 = await read(pg);
    console.log(`    · ${tag}: ${JSON.stringify(r0)}`);
    check(`${tag}: thanh module đang hiện có mục Hộp việc (để ca số đỏ không xanh suông)`, r0.navs >= 1 && r0.inboxItem >= 1, r0);
    check(`${tag}: KHÔNG có số đỏ nào trên thanh module (số đỏ = 0)`, r0.badges.length === 0, r0.badges);
    check(`${tag}: "Cần cô xử lý" rỗng — "Không có việc nào đang chờ cô", không dòng, không "N việc"`, r0.empty && r0.rows === 0 && r0.aside === null, r0);
    check(`${tag}: số đỏ (0) = số việc nhìn thấy (0)`, badgeNum(r0) === visibleCount(r0) && badgeNum(r0) === r0.rowSum, [badgeNum(r0), visibleCount(r0), r0.rowSum]);
    check(`${tag}: không có dòng nhắc "chưa có lịch học" (cờ lịch tắt)`, !r0.noSched);
    check(`${tag}: em chờ phụ huynh ở khối "Chờ phụ huynh" (không tính là việc)`, r0.waitText.includes("Em Chờ Phụ Huynh") && r0.waitText.includes("Không tính là việc cô cần làm"), r0.waitText.slice(0, 300));
    await pg.screenshot({ path: `${SHOTS}/loi-02-hop-viec-0-${tag}.png`, fullPage: true });

    // Đối chứng dương: 1 yêu cầu xin vào lớp ⇒ đúng 1 việc.
    const jr = await prisma.classJoinRequest.create({ data: { userId: SC.id, courseId: cSu.id, status: "pending" } });
    await openInbox(pg);
    const r1 = await read(pg);
    console.log(`    · ${tag} +1 xin vào lớp: ${JSON.stringify({ badges: r1.badges, aside: r1.aside, rows: r1.rows, rowSum: r1.rowSum })}`);
    check(`${tag}: +1 yêu cầu xin vào lớp → số đỏ "1" ở đúng mục Hộp việc (/lop-cua-toi), không mục nào khác có số`, r1.badges.length === 1 && r1.badges[0].href === "/lop-cua-toi" && r1.badges[0].text === "1", r1.badges);
    check(`${tag}: "Cần cô xử lý · 1 việc", đúng 1 dòng bắt đầu bằng "1"`, r1.aside === "1 việc" && r1.rows === 1 && r1.rowSum === 1, r1);
    check(`${tag}: số đỏ = số việc nhìn thấy (1)`, badgeNum(r1) === visibleCount(r1) && badgeNum(r1) === r1.rowSum, [badgeNum(r1), visibleCount(r1), r1.rowSum]);
    await pg.screenshot({ path: `${SHOTS}/loi-02-hop-viec-1-${tag}.png`, fullPage: true });

    if (W === 1600) {
      // H3: xử lý việc bằng fetch (không điều hướng) → cửa sổ lấy lại focus → số đỏ phải về 0 không cần tải lại.
      section("H3 · 1600: duyệt bằng fetch rồi lấy lại focus → số đỏ về 0 không tải lại trang");
      const st = await pg.evaluate(async ([c, j]: string[]) => {
        const r = await fetch(`/api/tutor/lop/${encodeURIComponent(c)}/yeu-cau/${encodeURIComponent(j)}/duyet`, { method: "POST", body: new FormData(), redirect: "manual", credentials: "same-origin" });
        return r.type === "opaqueredirect" ? 303 : r.status;
      }, [cSu.id, jr.id]);
      check("duyệt (POST …/duyet) → chuyển hướng 303, em thành active", st === 303 && (await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: SC.id, courseId: cSu.id } } }))?.status === "active", st);
      const urlBefore = pg.url();
      await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
      let r2: Read | null = null;
      for (let i = 0; i < 50; i++) { await pg.waitForTimeout(300); r2 = await read(pg); if (r2.badges.length === 0 && r2.rows === 0) break; }
      check("sau focus: số đỏ biến mất (0) và 'Cần cô xử lý' rỗng — cùng trang, không điều hướng", !!r2 && r2.badges.length === 0 && r2.rows === 0 && r2.empty && pg.url() === urlBefore, r2);
    } else {
      await prisma.classJoinRequest.delete({ where: { id: jr.id } });
    }
    // Trả về đúng tình huống của chủ cho khổ sau (em SC thôi học / không còn yêu cầu).
    await prisma.enrollment.deleteMany({ where: { userId: SC.id, courseId: cSu.id } });
    await prisma.classJoinRequest.deleteMany({ where: { userId: SC.id, courseId: cSu.id } });
    await ctx.close();
  }

  check("không lỗi JS / console", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
