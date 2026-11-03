// BU-04 — khách (chưa đăng nhập) mở trang học sinh của phòng thi → về /dang-nhap?redirect=<trang đó>; không thấy tên đề / câu hỏi trong lúc chờ. Học sinh mở trang gia sư/quản trị → bị đưa đi, không thấy khung gia sư.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-exam-guest-redirect.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { mkExam, mkFiveQuestions, SEC } from "./exam-room-fx";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const A = await mkUser({ name: "Em An" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: C.id, status: "active" } });
  const E = await mkExam({ id: "gr-main", ownerId: T.id, courseId: C.id, mode: "practice", title: "Đề riêng của lớp" }); await mkFiveQuestions(E.id, "gr");
  await launch();

  section("Khách mở trang học sinh");
  for (const path of ["/student/bai-tap", "/student/viec-cua-toi", `/student/thi-thu/${E.id}`]) {
    const c = await ctxFor(null, { width: 1280, height: 900 }); const p = await c.newPage();
    await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await p.waitForURL(/\/dang-nhap/, { timeout: 60000 }).catch(() => {});
    const u = new URL(p.url());
    check(`khách mở ${path} → /dang-nhap?redirect=…`, u.pathname === "/dang-nhap" && decodeURIComponent(u.searchParams.get("redirect") ?? "").startsWith(path.split("?")[0]), p.url());
    const html = await p.content();
    check(`  …và DOM không chứa tên đề / lời giải mồi`, !html.includes("Đề riêng của lớp") && !html.includes(SEC.expl(`gr-mc`)), "");
    await c.close();
  }

  section("Học sinh mở trang gia sư / quản trị");
  for (const path of ["/lop-cua-toi/de-thi", "/lop-cua-toi/quan-lop", "/lop-cua-toi/lop"]) {
    const c = await ctxFor(A, { width: 1280, height: 900 }); const p = await c.newPage();
    await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    const u = new URL(p.url());
    check(`học sinh mở ${path} → không còn ở ${path}`, !u.pathname.startsWith(path), p.url());
    check("  …khung là của học sinh (không có nút 'Tạo đề' của gia sư)", (await p.getByRole("button", { name: /Tạo đề|Thêm câu hỏi/ }).count()) === 0 && /học sinh/i.test(((await p.locator("#kin-rail .kin-rail-role").first().textContent().catch(() => "")) ?? "")), p.url());
    await c.close();
  }
  await closeAll();
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
