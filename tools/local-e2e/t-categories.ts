import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị");
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S = await mkUser({ name: "Học sinh" });
  const mk = async (owner: string, name: string, category: string, status = true) => { const c = await mkCourse(owner, { name }); await prisma.course.update({ where: { id: c.id }, data: { category, status } }); return c; };
  await mk(T.id, "Toán 9 A", "Toán"); await mk(T.id, "Toán 9 B", "Toán"); await mk(T2.id, "Toán 10", "Toán"); await mk(T2.id, "Toán ẩn", "Toán", false);
  await mk(T2.id, "Lý 9", "Lý");
  const cats = (r: any) => Object.fromEntries((r.json?.categories ?? []).map((c: any) => [c.name, c.courseCount]));

  section("GET /api/categories: danh sách TÊN chung, con số theo người xem");
  const anon = await api("GET", "/api/categories");
  check("khách: thấy đủ tên; đếm chỉ khoá đang công khai (Toán 3, không tính khoá ẩn)", anon.status === 200 && anon.json.scope === "public" && anon.json.canEdit === false && JSON.stringify(cats(anon)) === JSON.stringify({ "Lý": 1, "Toán": 3 }), anon.json);
  const stu = await api("GET", "/api/categories", { as: S });
  check("học viên: như khách", stu.json.scope === "public" && stu.json.canEdit === false && cats(stu)["Toán"] === 3);
  const t1 = await api("GET", "/api/categories", { as: T });
  check("gia sư: thấy ĐỦ tên danh mục chung (để chọn khi tạo khoá) nhưng đếm chỉ khoá CỦA MÌNH (Toán 2, Lý 0)", t1.json.scope === "mine" && t1.json.canEdit === false && JSON.stringify(cats(t1)) === JSON.stringify({ "Lý": 0, "Toán": 2 }), t1.json);
  const t2 = await api("GET", "/api/categories", { as: T2 });
  check("gia sư khác: Toán 2 (kể cả khoá ẩn của mình), Lý 1", JSON.stringify(cats(t2)) === JSON.stringify({ "Lý": 1, "Toán": 2 }) && t2.json.scope === "mine", t2.json);
  const sa = await api("GET", "/api/categories", { as: SA });
  check("quản trị: đếm mọi khoá (Toán 4 gồm khoá ẩn, Lý 1), canEdit = true", sa.json.scope === "all" && sa.json.canEdit === true && JSON.stringify(cats(sa)) === JSON.stringify({ "Lý": 1, "Toán": 4 }), sa.json);
  check("tên giống nhau với mọi người (chỉ khác con số)", JSON.stringify(Object.keys(cats(anon))) === JSON.stringify(Object.keys(cats(sa))) && JSON.stringify(Object.keys(cats(t1))) === JSON.stringify(Object.keys(cats(sa))));

  section("PUT: chỉ quản trị đổi tên (ảnh hưởng khoá của MỌI gia sư)");
  const put = (as: any, body: unknown) => api("PUT", "/api/categories", { as, body });
  check("chưa đăng nhập → 401; học viên → bị chặn", (await put(undefined, { oldName: "Toán", newName: "Toán học" })).status === 401 && [401, 403].includes((await put(S, { oldName: "Toán", newName: "Toán học" })).status));
  const tr = await put(T, { oldName: "Toán", newName: "Toán học" });
  check("gia sư → 403 kèm lý do; dữ liệu KHÔNG đổi", tr.status === 403 && /quản trị viên/i.test(tr.json?.error ?? "") && (await prisma.course.count({ where: { category: "Toán" } })) === 4, tr.json);
  check("tên không hợp lệ → 400 (thiếu, trùng tên cũ)", (await put(SA, {})).status === 400 && (await put(SA, { oldName: "Toán", newName: "Toán" })).status === 400);
  const ok = await put(SA, { oldName: "Toán", newName: "Toán học" });
  check("quản trị đổi tên → 200 và đổi khoá của CẢ HAI gia sư (kể cả khoá ẩn)", ok.status === 200 && (await prisma.course.count({ where: { category: "Toán học" } })) === 4 && (await prisma.course.count({ where: { category: "Toán" } })) === 0);
  check("danh sách sau đổi tên: gia sư thấy tên mới, đếm của mình vẫn 2", JSON.stringify(cats(await api("GET", "/api/categories", { as: T }))) === JSON.stringify({ "Lý": 0, "Toán học": 2 }));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
