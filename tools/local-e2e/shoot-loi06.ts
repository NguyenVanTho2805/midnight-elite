// LOI-06 — ảnh trước / sau của ô chọn ở 390 và 1600: trang Học sinh của gia sư (ô Lớp, ô Cảnh báo), trang học sinh (Phiếu học phí · Tháng),
// trang quản trị (Học sinh · Lọc theo lớp), ô chọn trong panel bên (Khung giờ · Kết thúc). Mỗi chỗ: ảnh đóng + ảnh đang mở (với <select> gốc
// trình duyệt không vẽ danh sách vào ảnh chụp không đầu — ảnh "trước" chỉ có trạng thái đóng là thật).
// Chạy: SHOTS=<thư mục> NHAN=truoc|sau npx tsx tools/local-e2e/shoot-loi06.ts — tự dựng dữ liệu trong DB thử (không chạy trên DB thật).
// Tự chứa (chỉ dùng launch/ctxFor của ui.ts và mk* của h.ts) để chạy được cả trên mã TRƯỚC LOI-06.
import { mkdirSync } from "node:fs";
import { BASE, mkTutor, mkUser, mkSuper, mkCourse, mkAttendanceSession } from "./h";
import { launch, ctxFor, closeAll, ADMIN, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const DIR = process.env.SHOTS ?? "scratchpad/shots-loi06";
const NHAN = process.env.NHAN ?? "sau";
mkdirSync(DIR, { recursive: true });
const snap = (p: Page, name: string) => p.screenshot({ path: `${DIR}/${NHAN}-${name}.png` });
const hide = (p: Page) => p.addStyleTag({ content: "[data-agentation-root],nextjs-portal{display:none!important}" }).catch(() => {});

async function openAndShoot(p: Page, combo: ReturnType<Page["getByRole"]>, name: string) {
  await combo.scrollIntoViewIfNeeded().catch(() => {});
  await snap(p, `${name}-dong`);
  if ((await combo.evaluate(e => e.tagName)) === "BUTTON") {
    await combo.click();
    await p.locator("[data-kin-select-mo]").waitFor({ timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(250);
    await snap(p, `${name}-mo`);
    await p.keyboard.press("Escape");
  }
}

(async () => {
  const T = await mkTutor("Cô Lan Ảnh");
  const SU = await mkSuper("Quản trị Ảnh");
  const names = ["Lịch Sử - Tổng Ôn", "Toán 9 Nâng cao", "Văn 8", "Anh 7", "Lý 10"];
  const courses = [];
  for (const n of names) courses.push(await mkCourse(T.id, { name: n }));
  const studs = [];
  for (let i = 0; i < 6; i++) {
    const s = await mkUser({ name: `Học sinh Ảnh ${i + 1}` });
    studs.push(s);
    await prisma.enrollment.create({ data: { userId: s.id, courseId: courses[i % courses.length].id, status: "active" } });
  }
  for (let d = 1; d <= 3; d++) await mkAttendanceSession(courses[0].id, T.id, new Date(Date.now() - d * 86400_000), ["absent"]).catch(() => {});

  await launch();
  for (const [W, H] of [[1600, 900], [390, 844]] as const) {
    const ct = await ctxFor(T, { width: W, height: H }), pt = await ct.newPage();
    await pt.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 170000 });
    await hide(pt);
    const lop = pt.getByRole("combobox", { name: /^Lớp/ }).first();
    await lop.waitFor({ timeout: 120000 });
    await openAndShoot(pt, lop, `gia-su-hoc-sinh-o-lop-${W}`);
    const cb = pt.getByRole("combobox", { name: /^Cảnh báo/ }).first();
    if (await cb.count()) await openAndShoot(pt, cb, `gia-su-hoc-sinh-o-canh-bao-${W}`);

    await pt.goto(`${BASE}/lop-cua-toi/lich/khung?lop=${courses[1].id}`, { waitUntil: "networkidle", timeout: 170000 });
    await hide(pt);
    await pt.locator("[data-add-block]").click({ timeout: 120000 });
    const se = pt.locator("#sched-e");
    await se.waitFor({ timeout: 30000 });
    await openAndShoot(pt, pt.getByRole("combobox", { name: /^Kết thúc/ }).first(), `panel-khung-gio-ket-thuc-${W}`);
    await ct.close();

    const cs = await ctxFor(studs[0], { width: W, height: H }), ps = await cs.newPage();
    await ps.goto(`${BASE}/student/hoc-phi`, { waitUntil: "networkidle", timeout: 170000 });
    await hide(ps);
    const th = ps.getByRole("combobox").first();
    await th.waitFor({ timeout: 120000 });
    await openAndShoot(ps, th, `hoc-sinh-hoc-phi-thang-${W}`);
    await cs.close();

    const ca = await ctxFor(SU, { width: W, height: H }), pa = await ca.newPage();
    await pa.goto(`${ADMIN}/admin/hoc-sinh`, { waitUntil: "networkidle", timeout: 170000 });
    await hide(pa);
    const ll = pa.getByTestId("loc-lop");
    await ll.waitFor({ timeout: 120000 });
    await openAndShoot(pa, ll as unknown as ReturnType<Page["getByRole"]>, `quan-tri-hoc-sinh-loc-lop-${W}`);
    await ca.close();
  }
  await closeAll();
  console.log("ảnh ở", DIR);
  await prisma.$disconnect();
})().catch(async e => { console.error("CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
