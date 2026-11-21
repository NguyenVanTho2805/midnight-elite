// NC2-035, viết lại theo SCL-F2 (P2-26): toast "Đã tạo khoá học mới" sống ở trang /admin cũ, nay không còn đường tới. TaoLop (cửa tạo lớp duy nhất)
// đưa lớp mới về tab Học sinh › Mã mời với ?moi=1 → khối "Đã tạo lớp". Bài kiểm: có moi=1 thì báo, không có thì không; legacy ?tab=ma-moi&moi=1 về đúng đích.
import { BASE, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const c = await mkCourse(T.id, { name: "Toán 9 thử" });
  await launch();
  const errors: string[] = [];
  const ctx = await ctxFor(T, { width: 1280, height: 800 });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => errors.push(String(e)));
  const callout = () => pg.getByText("Đã tạo lớp", { exact: true }).first();

  section("Đích của TaoLop: Học sinh › Mã mời, có moi=1");
  await pg.goto(`${BASE}/lop-cua-toi/quan-lop/${c.id}/hoc-vien?muc=ma-moi&moi=1`, { waitUntil: "networkidle", timeout: 150000 });
  check("khối 'Đã tạo lớp' hiện", await callout().waitFor({ timeout: 30000 }).then(() => true, () => false));

  section("Không có moi=1: không báo");
  await pg.goto(`${BASE}/lop-cua-toi/quan-lop/${c.id}/hoc-vien?muc=ma-moi`, { waitUntil: "networkidle", timeout: 120000 });
  check("không có khối 'Đã tạo lớp'", (await pg.getByText("Đã tạo lớp", { exact: true }).count()) === 0);

  section("Liên kết cũ /lop-cua-toi/<lớp>?tab=ma-moi&moi=1 về đúng đích");
  await pg.goto(`${BASE}/lop-cua-toi/${c.id}?tab=ma-moi&moi=1`, { waitUntil: "networkidle", timeout: 120000 });
  const u = new URL(pg.url());
  check("về /hoc-vien?muc=ma-moi, giữ moi=1", u.pathname === `/lop-cua-toi/quan-lop/${c.id}/hoc-vien` && u.searchParams.get("muc") === "ma-moi" && u.searchParams.get("moi") === "1", pg.url());
  check("không lỗi script trang", errors.length === 0, errors);
  await closeAll();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
