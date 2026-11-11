// LOI-01 (rà soát COO, 11/11/2026) — bảng tin cộng đồng ẨN (cờ CONG_DONG tắt) nhưng "hỏi gia sư trong lớp" vẫn chạy. Trình duyệt thật, 1280 và 390.
// Kiểm:
//  A. /cong-dong/<id>: thành viên lớp + gia sư chủ lớp ở lại, khung gọn (data-kc-bare); người ngoài lớp, khách, bài chung, mã không có → CÙNG một kết quả (trang đầu theo vai).
//  B. /cong-dong?scope=<mã lớp>: học sinh trong lớp thấy "Hỏi đáp trong lớp", ô soạn khoá vào lớp (không có "Cộng đồng chung"), đăng câu hỏi được và câu hỏi vào đúng lớp
//     (courseId trong DB); gia sư chủ lớp thấy câu hỏi đó; khách bị chuyển về "/"; /cong-dong (không lớp) và scope=common bị chuyển về.
//  C. Lối vào: trang lớp của học sinh có "Hỏi gia sư trong lớp" → đúng địa chỉ; bảng tin chung không còn lối nào.
//  D. 390px: một cột, không tràn ngang, nút ≥ 44px.
// Chạy với máy chủ dev KHÔNG đặt NEXT_PUBLIC_KIN_MO_CONG_DONG (bài tự bỏ qua nếu cờ đang bật).
// Ca phá cố ý (đã chạy): bỏ dòng ngoại lệ classScopeOf trong features.blockedRouteFeature → bài sập ở phần B (học sinh bị đẩy về Việc của tôi, không thấy tiêu đề);
// trong src/app/(guest)/cong-dong/[id]/page.tsx bỏ `&& (await canAccessClass(...))` → ca "người ngoài lớp" đỏ.
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";

(async () => {
  if (featureOn("CONG_DONG")) { console.log("  (máy đang bật NEXT_PUBLIC_KIN_MO_CONG_DONG: bài này chỉ dành cho chế độ ẩn — bỏ qua)"); done(); return; }
  await wipe();
  const T = await mkTutor("Cô Hạnh");
  const S = await mkUser({ name: "Em Lan" }), OUT = await mkUser({ name: "Em Ngoài Lớp" });
  const C = await mkCourse(T.id, { name: "Lý 10 Hỏi đáp" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const classT = await prisma.thread.create({ data: { content: "Câu hỏi trong lớp: lực ma sát nghỉ tính sao ạ?", authorId: S.id, category: "hoi-dap", courseId: C.id } });
  const publicT = await prisma.thread.create({ data: { content: "Bài chung ngoài cộng đồng.", authorId: OUT.id, category: "kinh-nghiem" } });

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: any) => errors.push(`[${new URL(p.url()).pathname}${new URL(p.url()).search}] ${String(e)} ${String(e?.stack ?? "").split("\n").slice(1, 6).join(" | ")}`)); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(`[${new URL(p.url()).pathname}] ${m.text()}`); }); };
  const bare = async (p: any) => (await p.locator("[data-kc-bare]").count()) > 0;
  const settle = async (p: any, path: string) => { await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 }); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };

  section("A. /cong-dong/<id> khi bảng tin ẩn");
  const cs = await ctxFor(S, { width: 1280, height: 800 }); const ps = await cs.newPage(); watch(ps);
  await settle(ps, `/cong-dong/${classT.id}`);
  await ps.locator("[data-kc-thread]").waitFor({ timeout: 90000 });
  check("học sinh trong lớp mở bài lớp → ở lại đúng trang, khung gọn data-kc-bare, thấy nội dung", new URL(ps.url()).pathname === `/cong-dong/${classT.id}` && await bare(ps) && await ps.getByText("lực ma sát nghỉ").first().isVisible(), ps.url());
  check("không có thanh trái / cột phải của Cộng đồng (lối vào bảng tin chung)", await ps.getByRole("link", { name: "Bảng tin", exact: true }).count() === 0 && await ps.locator("aside[aria-label='Gợi ý cho bạn']").count() === 0);
  check("nút quay lại → hỏi đáp của chính lớp", (await ps.getByRole("link", { name: /Hỏi đáp của lớp/ }).first().getAttribute("href")) === `/cong-dong?scope=${C.id}`);
  const ct = await ctxFor(T, { width: 1280, height: 800 }); const pt = await ct.newPage(); watch(pt);
  await settle(pt, `/cong-dong/${classT.id}`);
  await pt.locator("[data-kc-thread]").waitFor({ timeout: 90000 });
  check("gia sư chủ lớp mở bài lớp (từ Hộp việc) → ở lại, khung gọn", new URL(pt.url()).pathname === `/cong-dong/${classT.id}` && await bare(pt), pt.url());
  const co = await ctxFor(OUT, { width: 1280, height: 800 }); const po = await co.newPage(); watch(po);
  const cg = await ctxFor(null, { width: 1280, height: 800 }); const pg = await cg.newPage(); watch(pg);
  for (const [who, page, home] of [["người ngoài lớp", po, "/student/viec-cua-toi"], ["khách", pg, "/"]] as const) {
    for (const [what, id] of [["bài lớp", classT.id], ["bài chung", publicT.id], ["mã không có", "khong-co-bai-nay"]] as const) {
      await settle(page, `/cong-dong/${id}`);
      await page.waitForURL(u => new URL(u).pathname === home, { timeout: 60000 }).catch(() => {});
      check(`${who} mở ${what} → ${home} (cùng một kết quả)`, new URL(page.url()).pathname === home && !(await bare(page)), page.url());
    }
  }
  await settle(ps, `/cong-dong/${publicT.id}`);
  await ps.waitForURL(u => new URL(u).pathname === "/student/viec-cua-toi", { timeout: 60000 }).catch(() => {});
  check("học sinh trong lớp mở bài CHUNG → Việc của tôi (bảng tin chung vẫn ẩn)", new URL(ps.url()).pathname === "/student/viec-cua-toi", ps.url());

  section("B. Hỏi đáp trong lớp: /cong-dong?scope=<mã lớp>");
  await settle(ps, `/cong-dong?scope=${C.id}`);
  await ps.getByRole("heading", { level: 1, name: /Hỏi đáp trong lớp/ }).waitFor({ timeout: 90000 });
  check("học sinh ở lại trang, tiêu đề 'Hỏi đáp trong lớp · <tên lớp>', khung gọn", new URL(ps.url()).pathname === "/cong-dong" && await bare(ps) && /Lý 10 Hỏi đáp/.test(await ps.getByRole("heading", { level: 1 }).innerText()), ps.url());
  await ps.locator("[data-kc-feed]").waitFor({ timeout: 60000 });
  check("thấy câu hỏi đã có của lớp", await ps.getByText("lực ma sát nghỉ").first().isVisible());
  await ps.locator("[data-kc-viet-bai]").click();
  check("ô soạn khoá vào lớp: có 'Đăng vào lớp: <tên lớp>', KHÔNG có lựa chọn 'Cộng đồng chung'", await ps.locator("[data-kc-lop-khoa]").isVisible() && /Lý 10 Hỏi đáp/.test(await ps.locator("[data-kc-lop-khoa]").innerText()) && await ps.locator("option", { hasText: "Cộng đồng chung" }).count() === 0);
  await ps.getByRole("radio", { name: "Câu hỏi" }).click();
  await ps.getByLabel("Tiêu đề câu hỏi").fill("Em hỏi bài định luật hai");
  await ps.getByLabel("Mô tả câu hỏi").fill("Gia tốc bằng lực chia khối lượng phải không ạ?");
  await ps.getByRole("button", { name: "Đăng", exact: true }).click();
  await ps.getByText("Em hỏi bài định luật hai").first().waitFor({ timeout: 60000 });
  const posted = await prisma.thread.findFirst({ where: { title: "Em hỏi bài định luật hai" }, select: { courseId: true, authorId: true } });
  check("đăng câu hỏi được, hiện ngay trong lớp; DB: courseId = lớp, đúng người hỏi (không lọt ra cộng đồng chung)", posted?.courseId === C.id && posted?.authorId === S.id, posted);
  await settle(pt, `/cong-dong?scope=${C.id}`);
  await pt.getByText("Em hỏi bài định luật hai").first().waitFor({ timeout: 90000 }).catch(() => {});
  check("gia sư chủ lớp mở hỏi đáp của lớp → thấy câu hỏi mới", new URL(pt.url()).pathname === "/cong-dong" && await pt.getByText("Em hỏi bài định luật hai").first().isVisible(), pt.url());
  await settle(po, `/cong-dong?scope=${C.id}`);
  await po.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  check("người ngoài lớp mở hỏi đáp của lớp → không thấy câu hỏi của lớp, có lời giải thích + lối đi tiếp", !(await po.getByText("lực ma sát nghỉ").count()) && await po.getByText(/không còn là thành viên/).first().isVisible().catch(() => false) && await po.getByRole("link", { name: "Về trang của tôi" }).count() >= 1);
  for (const [who, page, search, home] of [["khách", pg, `?scope=${C.id}`, "/"], ["học sinh", ps, "", "/student/viec-cua-toi"], ["học sinh", ps, "?scope=common", "/student/viec-cua-toi"], ["học sinh", ps, `?scope=${C.id}&tab=da-luu`, "/student/viec-cua-toi"]] as const) {
    await settle(page, `/cong-dong${search}`);
    await page.waitForURL(u => new URL(u).pathname === home, { timeout: 60000 }).catch(() => {});
    check(`${who} mở /cong-dong${search} → ${home} (bảng tin chung vẫn ẩn)`, new URL(page.url()).pathname === home, page.url());
  }

  section("C. Lối vào từ trang lớp");
  await settle(ps, `/student/hoc-tap?course=${C.id}`);
  const ask = ps.locator("[data-hoi-trong-lop]");
  await ask.waitFor({ timeout: 90000 });
  check("trang lớp của học sinh có 'Hỏi gia sư trong lớp' → /cong-dong?scope=<mã lớp>, cao ≥ 44px", (await ask.getAttribute("href")) === `/cong-dong?scope=${C.id}` && ((await ask.boundingBox())?.height ?? 0) >= 44);
  await ask.click();
  await ps.waitForURL(u => new URL(u).pathname === "/cong-dong" && new URL(u).searchParams.get("scope") === C.id, { timeout: 60000 });
  const h1 = ps.getByRole("heading", { level: 1, name: /Hỏi đáp trong lớp/ });
  await h1.waitFor({ timeout: 90000 }).catch(() => {});
  check("bấm lối đó → hỏi đáp của lớp (không bị đẩy đi)", await h1.isVisible() && new URL(ps.url()).pathname === "/cong-dong", ps.url());
  check("không còn liên kết nào tới bảng tin chung trên trang này", await ps.locator("a[href='/cong-dong'], a[href='/cong-dong?tab=all'], a[href='/cong-dong?tab=hoi-dap-qa'], a[href^='/cong-dong?tab=da-luu']").count() === 0);

  section("D. Điện thoại 390px");
  const cm = await ctxFor(S, { width: 390, height: 844 }); const pm = await cm.newPage(); watch(pm);
  await settle(pm, `/cong-dong?scope=${C.id}`);
  await pm.locator("[data-kc-feed]").waitFor({ timeout: 90000 });
  check("390px: không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  const small = await pm.evaluate(`[...document.querySelectorAll('[data-kc-root] a, [data-kc-root] button')].filter(e => e.offsetParent && !(e.tagName === 'A' && e.closest('[data-kc-feed] .kc-body'))).map(e => ({ t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44 && x.t)`) as { t: string; h: number }[];
  // Liên kết CHỮ trong thân thẻ bài (giờ đăng, tiêu đề, đoạn trích — FeedCard có sẵn, giống bảng tin công khai) không tính: vùng chạm của thẻ là hàng hành động bên dưới.
  check("390px: nút và liên kết điều hướng trong khung hỏi đáp cao ≥ 44px", small.length === 0, small.slice(0, 5));
  await shot(pm, "loi-hoi-dap-lop-390");
  await settle(pm, `/cong-dong/${classT.id}`);
  await pm.locator("[data-kc-thread]").waitFor({ timeout: 90000 });
  check("390px: bài lớp một cột, không tràn ngang", await pm.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(pm, "loi-bai-lop-390");

  section("Không lỗi trình duyệt");
  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await prisma.$disconnect();
  done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
