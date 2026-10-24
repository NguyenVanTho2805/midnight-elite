// Chụp /giang-vien và /mentor/[id] với dữ liệu cố định để so trước/sau khi tách component (FE-157/158).
import { mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
const TAG = process.argv[2] ?? "before";
(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khang"), T3 = await mkTutor("Nguyễn Văn Mới");
  await prisma.user.update({ where: { id: T.id }, data: { tutorVerified: true, bio: "Gia sư Toán 9 nhiều năm kinh nghiệm, dạy lớp nhỏ và theo sát từng em.", subjects: ["Toán 9", "Toán 10"], tutorVerifiedAt: new Date("2026-09-01T00:00:00Z") } });
  await prisma.user.update({ where: { id: T2.id }, data: { tutorVerified: true, bio: null, subjects: [] } });
  await prisma.user.update({ where: { id: T3.id }, data: { tutorVerified: true, bio: "Mới vào nghề, dạy Lý và Hoá cho học sinh lớp 8–9.", subjects: ["Vật lý", "Hoá học", "Sinh học", "Tin học", "Văn"] } });
  const c1 = await mkCourse(T.id, { name: "Toán 9", capacity: 5 }), c2 = await mkCourse(T.id, { name: "Toán 10" });
  for (let i = 0; i < 3; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS ${i}` })).id, courseId: c1.id, status: "active" } });
  for (const [c, d] of [[c1, "2026-09-03"], [c1, "2026-09-10"], [c2, "2026-09-11"]] as const) await mkAttendanceSession(c.id, T.id, new Date(`${d}T00:00:00Z`));
  await launch();
  const ctx = await ctxFor(null);
  for (const [name, w, h] of [["desktop", 1280, 900], ["mobile", 390, 800]] as const) {
    const c = await ctxFor(null, { width: w, height: h });
    for (const [label, url] of [["giang-vien", "http://localhost:3223/giang-vien"], ["mentor", `http://localhost:3223/mentor/${T.id}`], ["mentor-trong", `http://localhost:3223/mentor/${T2.id}`]] as const) {
      const p = await c.newPage();
      await p.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      // /giang-vien nạp danh sách bằng API ở máy khách: chụp khi thẻ đã hiện (trước đây chụp trúng khung chờ nên ảnh trước/sau không so được).
      // Chờ KHUNG CHỜ (animate-pulse) biến mất: chờ theo tên gia sư không đủ vì chữ có thể đã có trong DOM trước khi danh sách vẽ xong.
      if (label === "giang-vien") { await p.getByText("Nguyễn Văn Mới").first().waitFor({ timeout: 90000 }); await p.waitForFunction(() => !document.querySelector(".animate-pulse"), undefined, { timeout: 90000 }); }
      await p.waitForTimeout(800);
      // ẩn phần động không liên quan (nút Next dev, thông báo)
      await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }" });
      await p.screenshot({ path: `scratchpad/shots/${TAG}-${label}-${name}.png`, fullPage: true });
      await p.close();
    }
  }
  await ctx.close(); await closeAll();
  console.log("done", TAG);
})().catch(e => { console.error(e); process.exit(1); });
