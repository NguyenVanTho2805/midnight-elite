// Quyết định 1B (04/11/2026) trong trình duyệt thật — /bang-xep-hang:
//   KHÁCH : tab "Thi thử" chỉ thấy tên đã che, không trường, tối đa 10 hạng, có ghi chú + lối "Đăng nhập để xem đầy đủ" (kèm ?redirect=/bang-xep-hang);
//           tab "Vinh danh KiN" hiện màn "dành cho học viên đã đăng nhập" (KHÔNG phải lỗi tải / nút Thử lại), không lộ tên nào.
//   HỌC SINH ĐÃ ĐĂNG NHẬP: như cũ (tên đầy đủ, trường, không ghi chú, không màn chặn), tab Vinh danh có danh sách.
//   Điện thoại 390: không tràn ngang.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-bang-xep-hang.ts  (Postgres + Next dev; máy chủ KHÔNG đặt LEADERBOARD_CACHE_SECONDS)
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - page.tsx: bỏ khối `{maskedView && (<p data-guest-note …>` → ca "khách có ghi chú + lối đăng nhập" đỏ.
//   - page.tsx: đổi `maskedView` thành điều kiện theo trạng thái đăng nhập (`!authLoading && !user`) → thỉnh thoảng báo "Hydration failed" (đã gặp ~1/5 lần chạy) ở ca "không lỗi JS trang".
//   - page.tsx: bỏ `if (r.status === 401) { setNeedLogin(true); return []; }` → ca "tab Vinh danh: màn chặn, không phải lỗi tải" đỏ.
//   - leaderboard/route.ts: `shapeLeaderboard(sorted, true)` → các ca "khách không thấy tên đầy đủ / trường" đỏ.
import { prisma } from "@/lib/prisma";
import { mkUser, mkTutor, mkCourse, wipe, check, section, done, BASE } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";

const GIVEN = ["An", "Bình", "Cường", "Dũng", "Giang", "Hà", "Hải", "Hiếu", "Khánh", "Lan", "Minh", "Nam"];

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.exam.create({ data: { id: "e1", code: "e1", title: "e1", category: "toan", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", totalPoints: 150, createdAt: "2026-10-24" } as never });
  const S: Awaited<ReturnType<typeof mkUser>>[] = [];
  for (let i = 0; i < 12; i++) {
    const u = await mkUser({ name: `Nguyễn Văn ${GIVEN[i]}` });
    await prisma.user.update({ where: { id: u.id }, data: { school: `THPT Chuyên Số ${i}, Hà Nội` } });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });
    await prisma.examResult.create({ data: { userId: u.id, examId: "e1", score: 100 - i, totalPoints: 150 } });
    S.push(u);
  }

  await launch();
  const reactWarns: string[] = [];
  const pageErrors: string[] = [];
  const watch = (p: { on: (ev: string, cb: (x: never) => void) => unknown; url(): string }, label: string) => {
    p.on("pageerror", ((e: unknown) => pageErrors.push(`[${label}] ${String(e).slice(0, 2500)}`)) as never);
    p.on("console", ((m: { type(): string; text(): string }) => { if (m.type() === "error" && /Cannot update a component|while rendering a different component|Hydration|did not match/i.test(m.text())) reactWarns.push(m.text().slice(0, 160)); }) as never);
  };
  const text = (p: { evaluate: (f: string) => Promise<unknown> }) => p.evaluate("document.body.innerText") as Promise<string>;

  section("KHÁCH — tab Thi thử");
  const g = await (await ctxFor(null, { width: 1280, height: 900 })).newPage(); watch(g as never, "khách");
  await g.goto(`${BASE}/bang-xep-hang`, { waitUntil: "networkidle", timeout: 120000 });
  await g.getByText("học viên", { exact: false }).first().waitFor({ timeout: 60000 });
  let t = await text(g);
  check("hiện '· 10 học viên' (cắt 10 dù có 12)", /·\s*10 học viên/.test(t), t.slice(0, 200));
  check("hạng 1 là 'Nguyễn V. A.' (tên đã che)", /Nguyễn V\. A\./.test(t));
  check("KHÔNG thấy tên đầy đủ ('Nguyễn Văn An', 'Cường', 'Bình') ở bất kỳ chỗ nào", !/Nguyễn Văn|Cường|Bình|Dũng/.test(t), t.match(/Nguyễn Văn \S+/g));
  // "THPT" còn nằm ở chip kỳ thi ("THPT QG"…) nên dò đúng tên trường dựng sẵn ("Chuyên Số").
  check("KHÔNG thấy tên trường nào (fixture 'THPT Chuyên Số n')", !/Chuyên Số/.test(t));
  check("không hạng thứ 11 (tên 'Nam', 'Minh' không xuất hiện đầy đủ)", !/Nguyễn Văn Nam|Nguyễn Văn Minh/.test(t));
  const note = g.locator("[data-guest-note]");
  check("có ghi chú về tên viết tắt + 10 hạng đầu", (await note.count()) === 1 && /viết tắt/.test(await note.innerText()) && /10 hạng/.test(await note.innerText()));
  const href = await note.locator("a").first().getAttribute("href");
  check("lối 'Đăng nhập để xem đầy đủ' → /dang-nhap?redirect=%2Fbang-xep-hang", href === "/dang-nhap?redirect=%2Fbang-xep-hang", href);
  check("không có 'Không thể tải bảng xếp hạng'", !/Không thể tải bảng xếp hạng/.test(t));
  await shot(g, "bxh-khach-thi-thu").catch(() => {});

  section("KHÁCH — tab Vinh danh KiN");
  await g.getByRole("button", { name: "Vinh danh KiN" }).click();
  await g.locator("[data-honor-gate]").waitFor({ timeout: 30000 });
  t = await text(g);
  check("hiện màn 'dành cho học viên đã đăng nhập'", /Bảng vinh danh dành cho học viên đã đăng nhập/.test(t));
  check("KHÔNG phải lỗi tải: không 'Không thể tải bảng vinh danh', không nút 'Thử lại'", !/Không thể tải bảng vinh danh/.test(t) && (await g.getByRole("button", { name: "Thử lại" }).count()) === 0);
  check("không lộ tên / trường / GPA nào", !/Nguyễn|Chuyên Số|GPA/.test(t), t.match(/Nguyễn|Chuyên Số|GPA/g));
  const gateHref = await g.locator("[data-honor-gate] a").first().getAttribute("href");
  check("nút 'Đăng nhập' → /dang-nhap?redirect=%2Fbang-xep-hang", gateHref === "/dang-nhap?redirect=%2Fbang-xep-hang" && /Đăng nhập/.test(await g.locator("[data-honor-gate] a").first().innerText()), gateHref);
  await shot(g, "bxh-khach-vinh-danh").catch(() => {});
  await g.getByRole("button", { name: "Thi thử" }).click();
  await g.locator("[data-guest-note]").waitFor({ timeout: 30000 });
  await g.getByText("Nguyễn V. A.", { exact: false }).first().waitFor({ timeout: 30000 });
  t = await text(g);
  check("quay lại tab Thi thử vẫn tên che, không trường", /Nguyễn V\. A\./.test(t) && !/Nguyễn Văn|Chuyên Số/.test(t));

  section("HỌC SINH ĐÃ ĐĂNG NHẬP — như cũ");
  const sp = await (await ctxFor(S[0], { width: 1280, height: 900 })).newPage(); watch(sp as never, "học sinh");
  await sp.goto(`${BASE}/bang-xep-hang`, { waitUntil: "networkidle", timeout: 120000 });
  await sp.getByText("học viên", { exact: false }).first().waitFor({ timeout: 60000 });
  t = await text(sp);
  check("thấy cả 12 học viên", /·\s*12 học viên/.test(t), t.slice(0, 160));
  check("tên đầy đủ + trường", /Nguyễn Văn An/.test(t) && /THPT Chuyên Số 0/.test(t));
  check("KHÔNG có ghi chú dành cho khách", (await sp.locator("[data-guest-note]").count()) === 0);
  await sp.getByRole("button", { name: "Vinh danh KiN" }).click();
  await sp.getByText("học sinh KiN", { exact: false }).first().waitFor({ timeout: 30000 });
  t = await text(sp);
  check("tab Vinh danh có danh sách, KHÔNG có màn chặn", (await sp.locator("[data-honor-gate]").count()) === 0 && /Nguyễn Văn An/.test(t) && !/Không thể tải bảng vinh danh/.test(t), t.slice(0, 200));
  await shot(sp, "bxh-hocsinh-vinh-danh").catch(() => {});

  section("390 — điện thoại");
  const mp = await (await ctxFor(null, { width: 390, height: 800 })).newPage(); watch(mp as never, "390");
  await mp.goto(`${BASE}/bang-xep-hang`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.locator("[data-guest-note]").waitFor({ timeout: 60000 });
  check("tab Thi thử: không tràn ngang", await mp.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth") as boolean);
  await mp.getByRole("button", { name: "Vinh danh KiN" }).click();
  await mp.locator("[data-honor-gate]").waitFor({ timeout: 30000 });
  check("màn chặn: không tràn ngang", await mp.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth") as boolean);
  const btn = await mp.locator("[data-honor-gate] a").first().boundingBox();
  check("nút Đăng nhập cao ≥ 44px", !!btn && btn.height >= 44, btn);
  await shot(mp, "bxh-khach-390").catch(() => {});

  if (pageErrors.length) require("node:fs").writeFileSync("/tmp/hydr.txt", pageErrors.join("\n\n=====\n\n"));
  check("không lỗi JS trang", pageErrors.length === 0, pageErrors.map(x => x.slice(0, 60)));
  check("không cảnh báo React / lệch hydrate", reactWarns.length === 0, reactWarns.slice(0, 2));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", String(e).slice(0, 300)); process.exit(1); });
