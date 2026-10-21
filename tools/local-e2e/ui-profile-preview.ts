import { BASE, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), P = await mkTutor("Thầy Chờ Duyệt"), L = await mkTutor("Cô Bị Khoá");
  await prisma.user.update({ where: { id: T.id }, data: { tutorVerified: true, tutorVerifiedAt: new Date("2026-09-01T00:00:00Z"), bio: "Gia sư Toán 9 nhiều năm.", subjects: ["Toán 9"] } });
  await prisma.user.update({ where: { id: P.id }, data: { tutorVerified: false, bio: "Chờ duyệt", subjects: ["Lý"] } });
  await prisma.user.update({ where: { id: L.id }, data: { tutorVerified: true, profileLockedAt: new Date(), profileLockReason: "x", bio: "Bị khoá", subjects: ["Hoá"] } });
  const c1 = await mkCourse(T.id, { name: "Toán 9", capacity: 5 });
  for (let i = 0; i < 2; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS ${i}` })).id, courseId: c1.id, status: "active" } });
  for (const d of ["2026-09-03", "2026-09-10", "2026-09-17"]) await mkAttendanceSession(c1.id, T.id, new Date(`${d}T00:00:00Z`));

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); };

  section("Gia sư đã duyệt: xem trước đầu hồ sơ công khai");
  const page = await (await ctxFor(T)).newPage(); watch(page);
  await page.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("heading", { name: "Hồ sơ gia sư", level: 1 }).waitFor({ timeout: 90000 });
  const sec = page.getByRole("region", { name: /Hồ sơ công khai của bạn trông thế này/ });
  await sec.getByRole("heading", { name: "Cô Lan", level: 2 }).waitFor({ timeout: 30000 });
  check("chỉ MỘT h1 trên trang (phần xem trước dùng h2)", (await page.getByRole("heading", { level: 1 }).count()) === 1);
  const txt = (await sec.innerText()).replace(/\s+/g, " ");
  check("đúng thứ khách thấy: 'Đã xác minh', 'Không thu phí nhận lớp', môn, giới thiệu", txt.includes("Đã xác minh") && txt.includes("Không thu phí nhận lớp") && txt.includes("Toán 9") && txt.includes("Gia sư Toán 9 nhiều năm."), txt);
  check("bốn con số lấy từ sổ lớp: 1 lớp, 2 học viên, 3 buổi đã dạy", /2\s*Học viên/.test(txt) && /1\s*Lớp đang dạy/.test(txt) && /3\s*Buổi đã dạy/.test(txt), txt);
  check("nói rõ số buổi/lớp không có ô nhập tay + liên kết tới trang công khai", await sec.getByText(/không có ô nhập tay/).isVisible() && (await sec.getByRole("link", { name: "Mở trang công khai" }).getAttribute("href")) === `/mentor/${T.id}`);
  check("form sửa giới thiệu/môn vẫn có bên dưới", await page.getByRole("button", { name: /Lưu/ }).first().isVisible());
  await shot(page, "profile-preview");

  section("Chưa duyệt / bị khoá: không giả vờ có hồ sơ công khai");
  const pp = await (await ctxFor(P)).newPage(); watch(pp);
  await pp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await pp.getByRole("heading", { name: "Hồ sơ gia sư", level: 1 }).waitFor({ timeout: 60000 });
  check("chưa duyệt: 'sẽ hiện ở đây sau khi quản trị viên duyệt', không có tiêu đề gia sư h2", await pp.getByText(/sẽ hiện ở đây sau khi quản trị viên duyệt/).isVisible() && (await pp.getByRole("heading", { name: "Thầy Chờ Duyệt", level: 2 }).count()) === 0);
  const lp = await (await ctxFor(L)).newPage(); watch(lp);
  await lp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await lp.getByRole("heading", { name: "Hồ sơ gia sư", level: 1 }).waitFor({ timeout: 60000 });
  check("bị khoá: báo 'đang bị khoá', không hiện bản xem trước", await lp.getByText(/đang bị khoá nên khách chưa xem được/).isVisible() && (await lp.getByRole("heading", { name: "Cô Bị Khoá", level: 2 }).count()) === 0);

  section("Khoá sau khi mở trang: bản xem trước báo chưa công khai");
  await prisma.user.update({ where: { id: T.id }, data: { profileLockedAt: new Date(), profileLockReason: "x" } });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/đang bị khoá nên khách chưa xem được/).waitFor({ timeout: 30000 });
  check("sau khi bị khoá: chuyển sang thông báo", true);
  await prisma.user.update({ where: { id: T.id }, data: { profileLockedAt: null, profileLockReason: null } });

  section("Điện thoại 390px");
  const mp = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mp);
  await mp.goto(`${BASE}/lop-cua-toi/ho-so`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("heading", { name: "Cô Lan", level: 2 }).waitFor({ timeout: 60000 });
  check("không tràn ngang", await mp.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean);
  await shot(mp, "profile-preview-mobile");
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
