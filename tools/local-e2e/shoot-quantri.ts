// Chụp ba trang quản trị (so-do, pheu, ho-so-gia-su) + 404 để đối chiếu Figma. Cần máy chủ thử đã chạy và mock-seed (admin@kin.local).
// Không xoá DB (không gọi wipe). Báo cáo hồ sơ giả chỉ thêm khi chưa có.
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { ADMIN } from "./ui";
import { BASE } from "./h";

(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@kin.local" } });
  const tutor = await prisma.user.findFirstOrThrow({ where: { email: "giasu@kin.local" } });
  if ((await prisma.tutorProfileReport.count({ where: { status: "open" } })) === 0) {
    await prisma.tutorProfileReport.create({ data: { tutorId: tutor.id, reason: "gia-mao", detail: "Mô tả lớp không khớp thực tế (dữ liệu giả để chụp).", channel: "fb-hn9" } });
  }
  await launch();
  const au = { id: admin.id, role: "admin" as const, adminRole: admin.adminRole as "admin_super", email: admin.email, name: admin.name };
  for (const [tag, w, h] of [["1440", 1440, 1000], ["390", 390, 800]] as const) {
    const c = await ctxFor(au, { width: w, height: h });
    const cg = await ctxFor(null, { width: w, height: h });
    for (const [label, url, wait] of [
      ["qt-hoat-dong", `${ADMIN}/admin/so-do`, '[data-metric="zaloOpened"]'],
      ["qt-pheu", `${ADMIN}/admin/pheu`, "text=Theo kênh"],
      ["qt-duyet-ho-so", `${ADMIN}/admin/ho-so-gia-su`, "li, [data-kin-empty]"],
      ["404", `${BASE}/khong-co-trang-nay`, "text=Trang không tồn tại"],
    ] as const) {
      const p = await (label === "404" ? cg : c).newPage();
      await p.goto(url, { waitUntil: "networkidle", timeout: 180000 });
      await p.locator(wait).first().waitFor({ timeout: 90000 });
      await p.waitForTimeout(600);
      await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }" });
      await p.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/${label}-${tag}.png`, fullPage: true });
      console.log(label, tag, "overflow:", await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
      await p.close();
    }
    await c.close(); await cg.close();
  }
  await closeAll();
})().catch(e => { console.error(e); process.exit(1); });
