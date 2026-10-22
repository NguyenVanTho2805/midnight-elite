// NC2-035 — toast "Đã tạo khoá học mới" (?moi=1) chỉ hiện MỘT lần: xong là xoá tham số, F5 không báo lại.
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
  const TOAST = "Đã tạo khoá học mới";
  const url = `${BASE}/admin/khoa-hoc/${c.id}?tab=lich-hoc&moi=1`;

  section("Vừa tạo lớp: toast hiện một lần, tham số bị xoá khỏi URL");
  await pg.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText(TOAST).first().waitFor({ timeout: 20000 }).catch(() => {});
  check("toast hiện", (await pg.getByText(TOAST).count()) >= 1);
  await pg.waitForFunction(() => !location.search.includes("moi="), null, { timeout: 15000 }).catch(() => {});
  const u1 = new URL(pg.url());
  check("URL không còn moi=1", !u1.searchParams.has("moi"), pg.url());
  check("vẫn giữ nguyên trang lớp và tab Lịch học", u1.pathname === `/admin/khoa-hoc/${c.id}` && u1.searchParams.get("tab") === "lich-hoc", pg.url());

  section("F5: không báo lại");
  await pg.reload({ waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForTimeout(700); // toast chỉ sống vài giây — kiểm sớm để bản lỗi (báo lại sau F5) bị bắt
  check("sau F5: không toast", (await pg.getByText(TOAST).count()) === 0);
  check("sau F5: URL vẫn sạch", !new URL(pg.url()).searchParams.has("moi"), pg.url());

  section("Đối chứng: mở lại ?moi=1 lần nữa (vừa tạo lớp khác) vẫn báo");
  await pg.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByText(TOAST).first().waitFor({ timeout: 20000 }).catch(() => {});
  check("lần mở mới có moi=1 → toast hiện lại", (await pg.getByText(TOAST).count()) >= 1);
  check("không lỗi script trang", errors.length === 0, errors);
  await closeAll();
  done();
})().catch(async e => { console.error("CRASH", e); await closeAll(); process.exit(1); });
