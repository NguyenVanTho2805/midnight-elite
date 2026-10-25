// Chụp các màn chính (gia sư, học sinh, phụ huynh, khách, quản trị) ở 1440 và 390, sáng và tối, để so trước/sau khi đóng khung (23/10/2026).
// Chạy: npx tsx tools/local-e2e/shoot-khung.ts <nhãn: truoc|sau> [lọc tên]   — sau mock-seed; ảnh vào $SHOTS (mặc định scratchpad/shots).
import { launch, ctxFor, closeAll, ADMIN } from "./ui";
import { prisma } from "@/lib/prisma";
import { BASE } from "./h";
import { TOKENS } from "./student-world";
const TAG = process.argv[2] ?? "truoc";
const ONLY = process.argv[3];
(async () => {
  const T = await prisma.user.findUniqueOrThrow({ where: { email: "giasu@kin.local" } });
  const S = await prisma.user.findUniqueOrThrow({ where: { email: "hocsinh@kin.local" } });
  const A = await prisma.user.findUniqueOrThrow({ where: { email: "admin@kin.local" } });
  await prisma.user.update({ where: { id: T.id }, data: { preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  const course = await prisma.course.findFirstOrThrow({ where: { OR: [{ instructorId: T.id }, { createdById: T.id }] }, orderBy: { createdAt: "asc" } }).catch(() => null);
  type Shot = [string, any, string, string];
  const list: Shot[] = [
    ["gs-hopviec", T, BASE, "/lop-cua-toi"],
    ["gs-lop", T, BASE, "/lop-cua-toi/lop"],
    ["gs-hocphi", T, BASE, "/lop-cua-toi/hoc-phi"],
    ["gs-goi", T, BASE, "/lop-cua-toi/goi"],
    ["gs-baitap", T, BASE, "/lop-cua-toi/bai-tap"],
    ["gs-baocao", T, BASE, "/lop-cua-toi/bao-cao-thang"],
    ["gs-cai-dat", T, BASE, "/lop-cua-toi/cai-dat"],
    ...(course ? [["gs-lop-chitiet", T, BASE, `/lop-cua-toi/${course.id}`] as Shot] : []),
    ["hs-viec", S, BASE, "/student/viec-cua-toi"],
    ["hs-baitap", S, BASE, "/student/bai-tap"],
    ["hs-thithu", S, BASE, "/student/thi-thu"],
    ["hs-cong-vao-de", S, BASE, "/student/thi-thu/qz11-hon-hop"],
    ["ph-so", null, BASE, `/so-cua-con/${TOKENS.portal}`],
    ["ph-phieu", null, BASE, `/phieu/${TOKENS.invoice}`],
    ["khach-giangvien", null, BASE, "/giang-vien"],
    ["ad-sodo", A, ADMIN, "/admin/so-do"],
    ["ad-tong-quan", A, ADMIN, "/admin"],
  ];
  await launch();
  for (const [theme, mode] of [["sang", "sang"], ["toi", "toi"]] as const) {
    for (const [dev, w, h] of [["1440", 1440, 1000], ["390", 390, 844]] as const) {
      for (const [name, u, base, path] of list) {
        if (ONLY && !name.includes(ONLY)) continue;
        const c = await ctxFor(u, { width: w, height: h });
        await c.addInitScript(`try{localStorage.setItem("kin.che-do","${mode}")}catch(e){}`);
        const p = await c.newPage();
        try {
          await p.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 180000 });
          await p.waitForTimeout(1200);
          await p.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
          await p.screenshot({ path: `${process.env.SHOTS ?? "scratchpad/shots"}/${TAG}-${name}-${theme}-${dev}.png`, fullPage: true });
          const ov = await p.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
          if (ov) console.log("TRÀN NGANG:", name, theme, dev);
        } catch (e) { console.log("LỖI", name, theme, dev, String(e).slice(0, 120)); }
        await c.close();
      }
    }
  }
  await closeAll();
  console.log("xong", TAG);
})().catch(e => { console.error(e); process.exit(1); });
