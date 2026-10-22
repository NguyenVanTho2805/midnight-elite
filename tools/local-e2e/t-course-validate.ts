// NC2-035 — máy chủ từ chối giá trị vô lý của lớp do GIA SƯ gửi (POST /api/courses, PUT/PATCH /api/courses/[id]).
// Chỉ TỪ CHỐI; không đổi cách tính phí. Quản trị giữ hành vi cũ.
import { api, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { validateTutorCourseFields, MAX_TUTOR_COURSE_PRICE_VND, MAX_TUTOR_COURSE_LESSONS, MAX_TUTOR_COURSE_HOURS } from "@/lib/courseValidation";

let seq = 0;
const body = (o: Record<string, unknown> = {}) => ({
  id: `nc2-035-${Date.now().toString(36)}-${++seq}`, name: "Lớp thử NC2-035", adminName: "Lớp thử NC2-035", shortTitle: "LOP\nTHU", category: "Toán", instructor: "Cô Lan",
  teacherAvatar: "C", openDate: "01/01/2030", types: ["Video"], tag: null, tagColor: null, bg: "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)",
  price: 500_000, originalPrice: null, lessons: 12, hours: 24, status: true, ...o,
});

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), SUP = await mkSuper("Quản trị 1");

  section("Hàm thuần validateTutorCourseFields");
  const v = validateTutorCourseFields;
  check("hợp lệ → null", v({ price: 0, originalPrice: null, lessons: 0, hours: 0, status: false }) === null && v({}) === null);
  check("giá âm / không nguyên / chữ / NaN / Infinity bị chặn", [-1, 1.5, "500", NaN, Infinity, null, undefined, true].every(p => !!v({ price: p })));
  check(`giá đúng bằng trần ${MAX_TUTOR_COURSE_PRICE_VND} qua, trần + 1 bị chặn`, v({ price: MAX_TUTOR_COURSE_PRICE_VND }) === null && /vượt quá/.test(v({ price: MAX_TUTOR_COURSE_PRICE_VND + 1 }) ?? ""));
  check("giá gốc: null qua; âm / vượt trần bị chặn", v({ originalPrice: null }) === null && !!v({ originalPrice: -5 }) && !!v({ originalPrice: MAX_TUTOR_COURSE_PRICE_VND + 1 }));
  check("số bài âm / lẻ / vượt trần bị chặn; đúng trần qua", !!v({ lessons: -1 }) && !!v({ lessons: 2.5 }) && !!v({ lessons: MAX_TUTOR_COURSE_LESSONS + 1 }) && v({ lessons: MAX_TUTOR_COURSE_LESSONS }) === null);
  check("số giờ âm / lẻ / vượt trần bị chặn", !!v({ hours: -1 }) && !!v({ hours: 0.5 }) && !!v({ hours: MAX_TUTOR_COURSE_HOURS + 1 }));
  check("status chỉ nhận boolean", v({ status: "false" }) !== null && v({ status: 1 }) !== null && v({ status: null }) !== null && v({ status: true }) === null);

  section("POST /api/courses — gia sư");
  const ok = await api("POST", "/api/courses", { as: T, body: body() });
  check("giá trị hợp lệ → 201, ownerId = gia sư, giá giữ nguyên (không bị đổi)", ok.status === 201 && ok.json.ownerId === T.id && ok.json.price === 500_000 && ok.json.lessons === 12, ok.json);
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["giá âm", { price: -1 }, /Giá lớp không được âm/],
    ["giá lẻ", { price: 1000.5 }, /số nguyên/],
    ["giá là chữ", { price: "500000" }, /số nguyên/],
    ["giá vượt trần", { price: 5_000_000_000 }, /vượt quá 50\.000\.000/],
    ["giá gốc âm", { originalPrice: -1 }, /Giá gốc không được âm/],
    ["số bài âm", { lessons: -3 }, /Số bài không được âm/],
    ["số bài lẻ", { lessons: 2.5 }, /số nguyên/],
    ["số bài vượt trần", { lessons: 100000 }, /Số bài không được vượt quá/],
    ["số giờ âm", { hours: -1 }, /Số giờ/],
    ["status là chuỗi", { status: "false" }, /bật hoặc tắt/],
    ["status là số", { status: 0 }, /bật hoặc tắt/],
  ];
  const before = await prisma.course.count();
  for (const [name, o, re] of cases) {
    const r = await api("POST", "/api/courses", { as: T, body: body(o) });
    check(`${name} → 400 tiếng Việt`, r.status === 400 && re.test(r.json?.error ?? ""), [r.status, r.json]);
  }
  check("sau các lần bị từ chối: không tạo thêm lớp nào", (await prisma.course.count()) === before);
  const edge = await api("POST", "/api/courses", { as: T, body: body({ price: MAX_TUTOR_COURSE_PRICE_VND, lessons: 0, hours: 0, originalPrice: MAX_TUTOR_COURSE_PRICE_VND }) });
  check("đúng trần giá, 0 bài, 0 giờ → 201 (biên không bị chặn nhầm)", edge.status === 201, edge.json);
  const free = await api("POST", "/api/courses", { as: T, body: body({ price: 0, status: false }) });
  check("lớp miễn phí, ẩn → 201", free.status === 201 && free.json.status === false && free.json.price === 0, free.json);

  section("POST /api/courses — quản trị giữ hành vi cũ");
  const adm = await api("POST", "/api/courses", { as: SUP, body: body({ price: 80_000_000, lessons: 5000 }) });
  check("quản trị đặt giá 80 triệu / 5000 bài (vượt trần gia sư) → vẫn 201", adm.status === 201 && adm.json.price === 80_000_000, adm.json);

  section("PUT / PATCH /api/courses/[id] — gia sư sửa lớp của mình");
  const mine = await mkCourse(T.id, { name: "Lớp của tôi" });
  const put = (o: Record<string, unknown>, method = "PUT") => api(method, `/api/courses/${mine.id}`, { as: T, body: o });
  const p1 = await put({ price: 700_000, lessons: 20 });
  check("sửa hợp lệ → 200 và lưu đúng", p1.status === 200 && p1.json.price === 700_000 && p1.json.lessons === 20, p1.json);
  for (const [name, o, re] of [["giá âm", { price: -10 }, /không được âm/], ["giá vượt trần", { price: 999_999_999 }, /vượt quá/], ["số bài lẻ", { lessons: 1.5 }, /số nguyên/], ["status chuỗi", { status: "off" }, /bật hoặc tắt/]] as [string, Record<string, unknown>, RegExp][]) {
    const r = await put(o), r2 = await put(o, "PATCH");
    check(`${name}: PUT và PATCH đều 400`, r.status === 400 && r2.status === 400 && re.test(r.json?.error ?? ""), [r.status, r2.status, r.json]);
  }
  const after = await prisma.course.findUnique({ where: { id: mine.id } });
  check("giá trị cũ không bị ghi đè sau các lần bị từ chối", after?.price === 700_000 && after?.lessons === 20);
  const cap = await put({ capacity: 30, classStatus: "paused" }, "PATCH");
  check("PATCH chỉ đổi sức chứa / trạng thái lớp (không có giá) vẫn 200", cap.status === 200 && cap.json.capacity === 30, cap.json);
  const sup2 = await api("PUT", `/api/courses/${mine.id}`, { as: SUP, body: { price: 90_000_000 } });
  check("quản trị sửa giá 90 triệu → vẫn 200 (hành vi cũ)", sup2.status === 200 && sup2.json.price === 90_000_000, sup2.json);

  section("Lớp cũ có giá vượt trần (tạo trước khi có trần): vẫn sửa được phần khác");
  const old0 = await mkCourse(T.id, { name: "Lớp cũ giá cao" });
  const old = await prisma.course.update({ where: { id: old0.id }, data: { price: MAX_TUTOR_COURSE_PRICE_VND + 10_000_000 } });
  const rename = await api("PUT", `/api/courses/${old.id}`, { as: T, body: { name: "Đổi tên lớp cũ", price: old.price } });
  check("đổi tên, gửi lại đúng giá cũ → 200, giá cũ giữ nguyên", rename.status === 200 && (await prisma.course.findUniqueOrThrow({ where: { id: old.id } })).price === old.price, rename.json);
  const raise = await api("PUT", `/api/courses/${old.id}`, { as: T, body: { price: old.price + 1 } });
  check("ĐỔI giá lên mức vượt trần → vẫn 400", raise.status === 400, raise.json);
  const lower = await api("PUT", `/api/courses/${old.id}`, { as: T, body: { price: MAX_TUTOR_COURSE_PRICE_VND } });
  check("hạ giá về đúng trần → 200", lower.status === 200, lower.json);
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
