import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { emptyActivities } from "@/lib/sessionPlan";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S = await mkUser({ name: "Học sinh" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Toán 10" }), other = await mkCourse(T2.id, { name: "Lý 9" });
  const create = (as: any, body: unknown) => api("POST", "/api/tutor/session-plans", { as, body });
  const get = (as: any, id: string) => api("GET", `/api/tutor/session-plans/${id}`, { as });
  const put = (as: any, id: string, body: unknown) => api("PUT", `/api/tutor/session-plans/${id}`, { as, body });
  const acts = (patch: Record<number, Record<string, unknown>> = {}) => emptyActivities().map((a, i) => ({ ...a, ...(patch[i] ?? {}) }));

  section("Quyền");
  check("chưa đăng nhập → 401; học sinh → bị chặn", (await create(undefined, { courseId: c1.id })).status === 401 && [401, 403].includes((await create(S, { courseId: c1.id })).status) && [401, 403].includes((await api("GET", "/api/tutor/session-plans", { as: S })).status));

  section("Tạo kế hoạch");
  check("thiếu lớp → 400", (await create(T, {})).status === 400);
  check("lớp của gia sư khác → 404, không tạo", (await create(T, { courseId: other.id })).status === 404 && (await prisma.sessionPlan.count()) === 0);
  check("ngày sai → 400; tên quá dài → 400; tên sai kiểu → 400", (await create(T, { courseId: c1.id, dateKey: "2026-02-30" })).status === 400 && (await create(T, { courseId: c1.id, title: "x".repeat(121) })).status === 400 && (await create(T, { courseId: c1.id, title: 5 })).status === 400);
  const a = await create(T, { courseId: c1.id, dateKey: "2026-09-17" });
  check("tạo → 201; tên mặc định theo ngày", a.status === 201 && (await prisma.sessionPlan.findUnique({ where: { id: a.json.id } }))?.title === "Buổi 17/09");
  const b = await create(T, { courseId: c2.id });
  check("không ngày, không tên → 'Buổi mới'", (await prisma.sessionPlan.findUnique({ where: { id: b.json.id } }))?.title === "Buổi mới");
  const c = await create(T, { courseId: c1.id, title: "  Hàm số bậc nhất  ", dateKey: "2026-09-24" });
  check("tên được cắt khoảng trắng", (await prisma.sessionPlan.findUnique({ where: { id: c.json.id } }))?.title === "Hàm số bậc nhất");

  section("Đọc");
  const g = await get(T, a.json.id);
  check("200, 4 hoạt động trống đúng thứ tự, kèm tên lớp và mốc updatedAt", g.status === 200 && g.json.plan.activities.length === 4 && g.json.plan.activities.map((x: any) => x.key).join() === "mo-dau,hinh-thanh,luyen-tap,van-dung" && g.json.plan.courseName === "Toán 9" && !!g.json.plan.updatedAt, g.json);
  check("gia sư khác → 404 (không lộ có tồn tại hay không)", (await get(T2, a.json.id)).status === 404 && (await get(T, "khong-co")).status === 404);

  section("Lưu");
  const base = g.json.plan.updatedAt;
  const body = (over: Record<string, unknown> = {}) => ({ title: "Hàm số bậc nhất", goal: "Vẽ được đồ thị", dateKey: "2026-09-17", updatedAt: base, activities: acts({ 1: { minutes: 20, teacherNotes: "Gợi mở bằng ví dụ taxi", questions: [{ q: "Khi x tăng 1, y tăng bao nhiêu?", answer: "a" }], product: "Bảng giá trị" } }), ...over });
  check("dữ liệu sai → 400 và KHÔNG ghi (sai hoạt động)", (await put(T, a.json.id, body({ activities: acts().slice(0, 3) }))).status === 400 && (await prisma.sessionPlan.findUnique({ where: { id: a.json.id } }))?.goal === null);
  check("thiếu updatedAt → 400; updatedAt rác → 400", (await put(T, a.json.id, (() => { const x: any = body(); delete x.updatedAt; return x; })())).status === 400 && (await put(T, a.json.id, body({ updatedAt: "không phải ngày" }))).status === 400);
  check("gia sư khác không lưu được (404)", (await put(T2, a.json.id, body())).status === 404);
  const ok = await put(T, a.json.id, body());
  check("lưu → 200, trả bản mới + updatedAt mới", ok.status === 200 && ok.json.plan.goal === "Vẽ được đồ thị" && ok.json.plan.activities[1].minutes === 20 && ok.json.plan.updatedAt !== base, ok.json);
  const row = await prisma.sessionPlan.findUnique({ where: { id: a.json.id } });
  check("DB: tên, mục tiêu, ngày, 4 hoạt động đúng nội dung", row?.title === "Hàm số bậc nhất" && row.goal === "Vẽ được đồ thị" && row.dateKey === "2026-09-17" && (row.activities as any[])[1].teacherNotes === "Gợi mở bằng ví dụ taxi" && (row.activities as any[])[1].questions[0].answer === "a");
  check("danh sách hiện tên, lớp, số hoạt động đã soạn (1/4), tổng phút (20)", await (async () => { const l = await api("GET", "/api/tutor/session-plans", { as: T }); const it = l.json.items.find((x: any) => x.id === a.json.id); return it?.filled === 1 && it?.minutes === 20 && it?.courseName === "Toán 9"; })());

  section("Hai nơi cùng sửa: không ghi đè âm thầm");
  const stale = await put(T, a.json.id, body({ goal: "Bản cũ từ tab khác" })); // vẫn dùng updatedAt cũ (base)
  check("mốc cũ → 409, nội dung đã lưu không bị đè", stale.status === 409 && (await prisma.sessionPlan.findUnique({ where: { id: a.json.id } }))?.goal === "Vẽ được đồ thị", stale.json);
  const fresh = await get(T, a.json.id);
  check("tải lại lấy mốc mới rồi lưu được", (await put(T, a.json.id, { ...body({ goal: "Bản mới" }), updatedAt: fresh.json.plan.updatedAt })).status === 200);
  const f2 = (await get(T, a.json.id)).json.plan.updatedAt;
  const race = await Promise.all([1, 2, 3, 4].map(n => put(T, a.json.id, { ...body({ goal: `Song song ${n}` }), updatedAt: f2 })));
  check("4 lần lưu song song cùng một mốc: chỉ 1 thành công, 3 bị 409", race.filter(r => r.status === 200).length === 1 && race.filter(r => r.status === 409).length === 3, race.map(r => r.status));

  section("Danh sách");
  const all = await api("GET", "/api/tutor/session-plans", { as: T });
  check("3 kế hoạch của mình; có danh sách lớp để chọn", all.json.items.length === 3 && all.json.courses.length === 2);
  check("lọc theo lớp", (await api("GET", `/api/tutor/session-plans?courseId=${c2.id}`, { as: T })).json.items.length === 1);
  check("không thấy kế hoạch của gia sư khác", (await api("GET", "/api/tutor/session-plans", { as: T2 })).json.items.length === 0);
  const o2 = await create(T2, { courseId: other.id, title: "Của thầy" });
  check("kế hoạch của thầy khác không lẫn vào danh sách của mình", (await api("GET", "/api/tutor/session-plans", { as: T })).json.items.length === 3 && (await api("GET", "/api/tutor/session-plans", { as: T2 })).json.items.length === 1);

  section("Xoá");
  check("gia sư khác không xoá được (404) và kế hoạch còn nguyên", (await api("DELETE", `/api/tutor/session-plans/${a.json.id}`, { as: T2 })).status === 404 && (await prisma.sessionPlan.count({ where: { id: a.json.id } })) === 1);
  check("chủ xoá → 200; xoá lại → 404", (await api("DELETE", `/api/tutor/session-plans/${a.json.id}`, { as: T })).status === 200 && (await api("DELETE", `/api/tutor/session-plans/${a.json.id}`, { as: T })).status === 404);
  check("xoá tài khoản gia sư thì kế hoạch đi theo (cascade)", await (async () => { await prisma.user.delete({ where: { id: T2.id } }); return (await prisma.sessionPlan.count({ where: { id: o2.json.id } })) === 0; })());

  section("Giới hạn số lượng");
  await prisma.sessionPlan.createMany({ data: Array.from({ length: 498 }, (_, i) => ({ courseId: c1.id, tutorId: T.id, title: `seed ${i}`, activities: emptyActivities() as any })) });
  check("đủ 500 → không tạo thêm (409)", (await prisma.sessionPlan.count({ where: { tutorId: T.id } })) === 500 && (await create(T, { courseId: c1.id })).status === 409);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
