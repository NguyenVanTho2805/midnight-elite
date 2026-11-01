// CAT-02 (API + DB thật): danh sách khoá quản trị, hàng loạt + hoàn tác, danh mục (tạo/đổi tên/xoá/thứ tự), quyền, nhật ký, TIỀN không đổi.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "QT nội dung", role: "admin", adminRole: "admin_content" });
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Hùng");
  const stu = await mkUser({ name: "Học sinh Bí Mật" });
  const c1 = await mkCourse(T1.id, { name: "Toán của Lan" }), c2 = await mkCourse(T2.id, { name: "Lý của Hùng" }), c3 = await mkCourse(null, { name: "Hoá trung tâm" });
  await prisma.course.update({ where: { id: c1.id }, data: { category: "ĐGNL HSA", price: 2990000, originalPrice: 4990000, zaloGroupLink: "https://zalo.me/g/bimat" } });
  await prisma.course.update({ where: { id: c2.id }, data: { category: "Toán", price: 150000 } });
  await prisma.course.update({ where: { id: c3.id }, data: { category: "Toán" } });
  const e = (status: string) => mkUser({ name: "Em " + status }).then(u => prisma.enrollment.create({ data: { userId: u.id, courseId: c1.id, status } }));
  await e("active"); await e("pending_consent"); await e("suspended");
  const snap = async () => JSON.stringify((await prisma.course.findMany({ orderBy: { id: "asc" }, select: { id: true, price: true, originalPrice: true } })));
  const feeBefore = { rates: await prisma.courseFeeRate.count(), inv: await prisma.invoice.count() };
  const priceBefore = await snap();

  section("Quyền");
  check("không phiên → 401 (khoá học và danh mục)", (await api("GET", "/api/admin/khoa-hoc")).status === 401 && (await api("GET", "/api/admin/danh-muc")).status === 401);
  check("học sinh → 403", (await api("GET", "/api/admin/khoa-hoc", { as: stu })).status === 403 && (await api("GET", "/api/admin/danh-muc", { as: stu })).status === 403);
  const anyCat = (await api("GET", "/api/admin/danh-muc", { as: SA })).json.categories[0];
  check("teacher gọi danh mục: GET/POST/PUT/DELETE/thu-tu đều 403",
    (await api("GET", "/api/admin/danh-muc", { as: T1 })).status === 403 &&
    (await api("POST", "/api/admin/danh-muc", { as: T1, body: { name: "Moi" } })).status === 403 &&
    (await api("PUT", `/api/admin/danh-muc/${anyCat.id}`, { as: T1, body: { name: "Moi" } })).status === 403 &&
    (await api("DELETE", `/api/admin/danh-muc/${anyCat.id}`, { as: T1 })).status === 403 &&
    (await api("PUT", "/api/admin/danh-muc/thu-tu", { as: T1, body: { ids: [] } })).status === 403);
  check("admin_content và admin_super → 200", (await api("GET", "/api/admin/danh-muc", { as: CA })).status === 200 && (await api("GET", "/api/admin/khoa-hoc", { as: SA })).status === 200);

  section("GET /api/admin/khoa-hoc");
  let r = await api("GET", "/api/admin/khoa-hoc", { as: T1 });
  check("teacher chỉ thấy khoá của mình; không quản danh mục", r.status === 200 && r.json.rows.length === 1 && r.json.rows[0].id === c1.id && r.json.canManageCategories === false, r.json);
  check("enrolled chỉ đếm active (1 active + pending + suspended → 1)", r.json.rows[0].enrolled === 1, r.json.rows[0]);
  check("payload KHÔNG có link nhóm Zalo / bg / link học", !/zalo|bg|onlineLink|meet/i.test(JSON.stringify(Object.keys(r.json.rows[0]))) && !r.text.includes("bimat"));
  r = await api("GET", "/api/admin/khoa-hoc", { as: SA });
  const row1 = r.json.rows.find((x: any) => x.id === c1.id);
  check("quản trị thấy cả 3 khoá, đúng hình 4.1", r.json.rows.length === 3 && r.json.canManageCategories === true && row1.tutor.id === T1.id && row1.tutor.name === "Cô Lan" && row1.price === 2990000 && r.json.truncated === false, r.json);
  check("facets: shown+hidden = 3, danh mục có đếm, không tên học sinh", r.json.facets.shown + r.json.facets.hidden === 3 && r.json.facets.categories.some((c: any) => c.name === "Toán" && c.count === 2) && !r.text.includes("Bí Mật") && !r.text.includes("Em active"));

  section("Hàng loạt + hoàn tác");
  const pub = async () => ((await api("GET", "/api/courses")).json as any[]).map((c: any) => c.id);
  const ids3 = [c1.id, c2.id, c3.id];
  check("trước khi ẩn: công khai thấy cả 3", (await pub()).filter(i => ids3.includes(i)).length === 3);
  r = await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: ids3, action: "set_status", status: false } });
  check("ẩn 3 khoá → updated 3, công khai không còn", r.status === 200 && r.json.updated.length === 3 && (await pub()).filter(i => ids3.includes(i)).length === 0, r.json);
  const prev = r.json.updated as { id: string; prev: { status: boolean } }[];
  r = await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: prev.filter(u => u.prev.status).map(u => u.id), action: "set_status", status: true, undo: true } });
  check("hoàn tác bằng prev → công khai trở lại", r.status === 200 && (await pub()).filter(i => ids3.includes(i)).length === 3);
  let logs = await prisma.auditLog.findMany({ where: { action: "course.bulk_update" }, orderBy: { createdAt: "asc" } });
  const m0: any = logs[0]?.metadata, m1: any = logs[1]?.metadata;
  check("một dòng nhật ký mỗi lời gọi (kể cả hoàn tác), có count/to, hoàn tác có undo", logs.length === 2 && m0.count === 3 && m0.to === false && m0.op === "set_status" && m1.undo === true && m1.to === true, logs.map(l => l.metadata));
  check("nhật ký không chứa tên học sinh", !JSON.stringify(logs).includes("Bí Mật") && logs.every(l => l.resourceType === "Course" && l.resourceId === "bulk"));
  r = await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: ["khong-co"], action: "set_status", status: false } });
  check("[phá] mã không tồn tại → skipped:not_found, không ghi nhật ký", r.status === 200 && r.json.skipped[0].reason === "not_found" && (await prisma.auditLog.count({ where: { action: "course.bulk_update" } })) === 2);
  check("[phá] ids rỗng 400; 101 mã 400; action:set_price 400; category rỗng 400",
    (await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: [], action: "set_status", status: true } })).status === 400 &&
    (await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: Array.from({ length: 101 }, (_, i) => "x" + i), action: "set_status", status: true } })).status === 400 &&
    (await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: [c1.id], action: "set_price", price: 1 } })).status === 400 &&
    (await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: [c1.id], action: "set_category", category: "" } })).status === 400);
  check("[phá] danh mục không tồn tại → 422", (await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: [c1.id], action: "set_category", category: "Không Có Thật" } })).status === 422);
  check("[phá] teacher + set_category → 403", (await api("POST", "/api/admin/khoa-hoc/bulk", { as: T1, body: { ids: [c1.id], action: "set_category", category: "Toán" } })).status === 403);
  r = await api("POST", "/api/admin/khoa-hoc/bulk", { as: T1, body: { ids: [c1.id, c2.id], action: "set_status", status: false } });
  const c2db = await prisma.course.findUnique({ where: { id: c2.id } });
  check("[phá] teacher ẩn khoá người khác → skipped:not_owner, CSDL không đổi; khoá của mình đổi", r.status === 200 && r.json.updated.length === 1 && r.json.skipped[0].reason === "not_owner" && c2db!.status === true && (await prisma.course.findUnique({ where: { id: c1.id } }))!.status === false, r.json);
  await api("POST", "/api/admin/khoa-hoc/bulk", { as: SA, body: { ids: [c1.id], action: "set_status", status: true } });
  check("học sinh không gọi được bulk", (await api("POST", "/api/admin/khoa-hoc/bulk", { as: stu, body: { ids: [c1.id], action: "set_status", status: false } })).status === 403);

  section("Danh mục: đồng bộ lười, tạo, trùng");
  r = await api("GET", "/api/admin/danh-muc", { as: SA });
  const names = r.json.categories.map((c: any) => c.name).sort();
  check("lần GET đầu tạo dòng cho mọi Course.category (Toán, ĐGNL HSA)", r.status === 200 && names.includes("Toán") && names.includes("ĐGNL HSA"), names);
  const n1 = await prisma.courseCategory.count();
  await api("GET", "/api/admin/danh-muc", { as: SA });
  check("idempotent: gọi hai lần không nhân đôi", (await prisma.courseCategory.count()) === n1);
  const toan = r.json.categories.find((c: any) => c.name === "Toán");
  check("đếm đúng: Toán 2 khoá, 2 hiển thị", toan.courses.total === 2 && toan.courses.shown === 2 && toan.courses.openForJoin === 2, toan);
  r = await api("POST", "/api/admin/danh-muc", { as: SA, body: { name: "  Tiếng Anh  " } });
  check("tạo danh mục trống → 201, slug, nằm cuối", r.status === 201 && r.json.category.name === "Tiếng Anh" && r.json.category.slug === "tieng-anh", r.json);
  const empty = r.json.category;
  const pubNames = ((await api("GET", "/api/categories")).json.categories as any[]);
  check("GET /api/categories công khai thấy danh mục trống, có sortOrder, theo thứ tự", pubNames.some(c => c.name === "Tiếng Anh" && typeof c.sortOrder === "number") && pubNames.every((c, i) => i === 0 || c.sortOrder > pubNames[i - 1].sortOrder));
  check("[phá] tạo trùng 'ĐGNL HSA' và 'dgnl hsa' → 409",
    (await api("POST", "/api/admin/danh-muc", { as: SA, body: { name: "ĐGNL HSA" } })).status === 409 &&
    (await api("POST", "/api/admin/danh-muc", { as: SA, body: { name: "dgnl hsa" } })).status === 409);
  check("[phá] tên rỗng / 61 ký tự / chứa \\u0000 → 400",
    (await api("POST", "/api/admin/danh-muc", { as: SA, body: { name: "  " } })).status === 400 &&
    (await api("POST", "/api/admin/danh-muc", { as: SA, body: { name: "a".repeat(61) } })).status === 400 &&
    (await api("POST", "/api/admin/danh-muc", { as: SA, body: { name: "ab\u0000cd" } })).status === 400);

  section("Danh mục: đổi tên, xoá, thứ tự");
  const hsa = (await api("GET", "/api/admin/danh-muc", { as: SA })).json.categories.find((c: any) => c.name === "ĐGNL HSA");
  const c4 = await mkCourse(T2.id, { name: "HSA của Hùng" }); await prisma.course.update({ where: { id: c4.id }, data: { category: "ĐGNL HSA" } });
  check("[phá] đổi sang tên đã có ('toan') → 409 và KHÔNG khoá nào đổi (trước đây gộp ngầm)", (await api("PUT", `/api/admin/danh-muc/${hsa.id}`, { as: SA, body: { name: "toan" } })).status === 409 && (await prisma.course.count({ where: { category: "ĐGNL HSA" } })) === 2);
  r = await api("PUT", `/api/admin/danh-muc/${hsa.id}`, { as: SA, body: { name: "ĐGNL HSA 2027" } });
  check("đổi tên: khoá của HAI gia sư cùng đổi, renamedCourses = 2", r.status === 200 && r.json.renamedCourses === 2 && (await prisma.course.count({ where: { category: "ĐGNL HSA 2027" } })) === 2 && (await prisma.course.count({ where: { category: "ĐGNL HSA" } })) === 0, r.json);
  const rn: any = (await prisma.auditLog.findFirst({ where: { action: "course_category.rename" } }))?.metadata;
  check("nhật ký rename có from/to/renamedCourses đúng", rn && rn.from === "ĐGNL HSA" && rn.to === "ĐGNL HSA 2027" && rn.renamedCourses === 2, rn);
  check("đường cũ PUT /api/categories: teacher 403; trùng tên 409; đổi hợp lệ 200",
    (await api("PUT", "/api/categories", { as: T1, body: { oldName: "Toán", newName: "X" } })).status === 403 &&
    (await api("PUT", "/api/categories", { as: SA, body: { oldName: "Toán", newName: "ĐGNL HSA 2027" } })).status === 409 &&
    (await api("PUT", "/api/categories", { as: SA, body: { oldName: "ĐGNL HSA 2027", newName: "ĐGNL HSA" } })).status === 200);
  const hsa2 = (await api("GET", "/api/admin/danh-muc", { as: SA })).json.categories.find((c: any) => c.name === "ĐGNL HSA");
  r = await api("DELETE", `/api/admin/danh-muc/${hsa2.id}`, { as: SA });
  check("xoá danh mục còn khoá → 409 kèm số khoá, dòng vẫn còn", r.status === 409 && r.json.courses === 2 && !!(await prisma.courseCategory.findUnique({ where: { id: hsa2.id } })), r.json);
  r = await api("DELETE", `/api/admin/danh-muc/${empty.id}`, { as: SA });
  check("xoá danh mục trống → 200 và GET không còn", r.status === 200 && !(await api("GET", "/api/admin/danh-muc", { as: SA })).json.categories.some((c: any) => c.id === empty.id));
  check("xoá lại → 404", (await api("DELETE", `/api/admin/danh-muc/${empty.id}`, { as: SA })).status === 404);

  const cur = (await api("GET", "/api/admin/danh-muc", { as: SA })).json.categories.map((c: any) => c.id) as string[];
  const rev = [...cur].reverse();
  r = await api("PUT", "/api/admin/danh-muc/thu-tu", { as: SA, body: { ids: rev } });
  const pubOrder = ((await api("GET", "/api/categories")).json.categories as any[]).map(c => c.name);
  const expectOrder = (await prisma.courseCategory.findMany({ where: { id: { in: rev } } })).sort((a, b) => rev.indexOf(a.id) - rev.indexOf(b.id)).map(c => c.name);
  check("đặt thứ tự → GET /api/categories trả đúng thứ tự", r.status === 200 && JSON.stringify(pubOrder) === JSON.stringify(expectOrder), { pubOrder, expectOrder });
  r = await api("PUT", "/api/admin/danh-muc/thu-tu", { as: SA, body: { ids: rev.slice(1) } });
  check("[phá] thiếu một id → 409 + current", r.status === 409 && Array.isArray(r.json.current) && r.json.current.length === rev.length, r.json);
  check("[phá] trùng id → 400", (await api("PUT", "/api/admin/danh-muc/thu-tu", { as: SA, body: { ids: [rev[0], ...rev] } })).status === 400);
  const [p1, p2] = await Promise.all([
    api("PUT", "/api/admin/danh-muc/thu-tu", { as: SA, body: { ids: cur } }),
    api("PUT", "/api/admin/danh-muc/thu-tu", { as: CA, body: { ids: rev } }),
  ]);
  const so = (await prisma.courseCategory.findMany({ select: { sortOrder: true } })).map(x => x.sortOrder);
  check("hai yêu cầu đồng thời: cả hai không 500, sortOrder vẫn là 1..n", [p1.status, p2.status].every(s => s === 200 || s === 409) && [...so].sort((a, b) => a - b).join() === so.map((_, i) => i + 1).join(), { p1: p1.status, p2: p2.status, so });
  check("nhật ký create/delete/reorder có mặt, không tên học sinh", (await prisma.auditLog.count({ where: { action: { in: ["course_category.create", "course_category.delete", "course_category.reorder"] } } })) >= 3 && !JSON.stringify(await prisma.auditLog.findMany()).includes("Bí Mật"));
  check("không ghi nhật ký khi 4xx: số dòng create = 1 dù đã thử tạo lỗi", (await prisma.auditLog.count({ where: { action: "course_category.create" } })) === 1);

  section("TIỀN không đổi");
  check("price/originalPrice của mọi khoá giữ nguyên sau mọi lời gọi", (await snap()) === priceBefore);
  check("CourseFeeRate và Invoice không đổi", (await prisma.courseFeeRate.count()) === feeBefore.rates && (await prisma.invoice.count()) === feeBefore.inv);

  await done();
})();
