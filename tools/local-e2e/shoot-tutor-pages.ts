// Chụp /giang-vien và /mentor/[id] với dữ liệu cố định để so trước/sau (FE-157/158, BU-06, LOI-05). Tham số: before|after. Cần Next ở cổng của BASE (env.sh).
// BU-06: ≥ 9 gia sư (đủ 2 hàng ở 4 cột) có bìa/video/giá/khu vực/hoạt động khác nhau, 1 gia sư không khai gì, lớp open / approve / có học phí.
// LOI-05: bộ chọn theo giao diện mới — thẻ [data-the-gia-su], khung chờ [data-luoi-cho], hồ sơ một trang (?tab= cũ bị bỏ qua, chờ [data-lop-dang-mo]), nút "Lọc (n)" + tờ "Lọc gia sư".
// Không dùng networkidle (trang có kết nối nền): domcontentloaded rồi chờ bộ chọn. Giữ các tên tệp cũ: <TAG>-giang-vien-desktop|mobile, <TAG>-mentor-..., <TAG>-mentor-trong-...
import { BASE, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
const TAG = process.argv[2] ?? "before";
const COVER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khang"), T3 = await mkTutor("Nguyễn Văn Mới");
  const ext = [] as { id: string }[];
  for (let i = 1; i <= 8; i++) ext.push(await mkTutor(`Gia sư mẫu ${i}`));
  await prisma.user.update({ where: { id: T.id }, data: { bio: "Gia sư Toán 9 nhiều năm kinh nghiệm, dạy lớp nhỏ và theo sát từng em.", subjects: ["Toán 9", "Toán 10"], city: "Hà Nội", tutorVerifiedAt: new Date("2026-09-01T00:00:00Z"), coverUrl: COVER, introVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", preferences: { teaching: { district: "Cầu Giấy", mode: "both", price: 150000, showPrice: true, credential: "ĐH Sư phạm Hà Nội" }, connections: { showZalo: true } }, phone: "0901234567" } });
  await prisma.user.update({ where: { id: T2.id }, data: { bio: null, subjects: [] } });
  await prisma.user.update({ where: { id: T3.id }, data: { bio: "Mới vào nghề, dạy Lý và Hoá cho học sinh lớp 8–9.", subjects: ["Vật lý", "Hoá học", "Sinh học", "Tin học", "Văn"] } });
  for (const [i, e] of ext.entries()) await prisma.user.update({ where: { id: e.id }, data: { subjects: [i % 2 ? "Hoá học" : "Tiếng Anh"], city: i % 3 ? "Hà Nội" : "Đà Nẵng", bio: "Gia sư mẫu để lưới đủ hai hàng.", preferences: { teaching: { mode: i % 2 ? "online" : "offline", price: 120000 + i * 20000, showPrice: i % 3 !== 0 } } } });
  const c1 = await mkCourse(T.id, { name: "Toán 9", capacity: 5 }), c2 = await mkCourse(T.id, { name: "Toán 10" });
  await prisma.course.update({ where: { id: c1.id }, data: { joinPolicy: "open", tag: "Miễn phí" } });
  await prisma.course.update({ where: { id: c2.id }, data: { joinPolicy: "approve", tag: "Miễn phí" } });
  const c3 = await mkCourse(T.id, { name: "Toán nâng cao có học phí" });
  await prisma.course.update({ where: { id: c3.id }, data: { joinPolicy: "approve", price: 500000 } });
  for (let i = 0; i < 3; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS ${i}` })).id, courseId: c1.id, status: "active" } });
  for (const [c, d] of [[c1, "2026-09-03"], [c1, "2026-09-10"], [c2, "2026-09-11"]] as const) await mkAttendanceSession(c.id, T.id, new Date(`${d}T00:00:00Z`));
  await launch();
  const B = BASE;
  for (const [name, w, h] of [["desktop", 1600, 900], ["mobile", 390, 844]] as const) {
    const c = await ctxFor(null, { width: w, height: h });
    const pages = [["giang-vien", `${B}/giang-vien`, "[data-the-gia-su]"], ["mentor", `${B}/mentor/${T.id}`, "[data-ho-so-dau]"], ["mentor-trong", `${B}/mentor/${T2.id}`, "[data-ho-so-dau]"],
      ["mentor-lop", `${B}/mentor/${T.id}?tab=lop`, "[data-lop-dang-mo]"], ["mentor-chi-so", `${B}/mentor/${T.id}?tab=chi-so`, "[data-lop-dang-mo]"], ["mentor-gioi-thieu", `${B}/mentor/${T.id}?tab=gioi-thieu`, "[data-gioi-thieu-ho-so]"]] as const;
    for (const [label, url, ready] of pages) {
      const p = await c.newPage();
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await p.locator(ready).first().waitFor({ timeout: 90000 });
      if (label === "giang-vien") await p.locator("[data-luoi-cho]").waitFor({ state: "detached", timeout: 90000 }).catch(() => undefined);
      await p.waitForTimeout(800);
      await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }" });
      await p.screenshot({ path: `scratchpad/shots/${TAG}-${label}-${name}.png`, fullPage: true });
      if (label === "giang-vien" && name === "mobile") {
        await p.getByRole("button", { name: /^Lọc \(/ }).click();
        await p.getByRole("dialog", { name: "Lọc gia sư" }).waitFor({ timeout: 15000 });
        await p.screenshot({ path: `scratchpad/shots/${TAG}-giang-vien-to-loc-mobile.png` });
      }
      await p.close();
    }
    await c.close();
  }
  await closeAll();
  console.log("done", TAG);
})().catch(e => { console.error(e); process.exit(1); });
