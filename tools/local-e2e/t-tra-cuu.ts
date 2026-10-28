// NC2-053 — /api/tra-cuu (cơ sở dữ liệu thật): người lạ chỉ thấy tên che + số khoá; chỉ chính học sinh (phiên trùng) thấy đủ; không khớp SĐT phụ huynh tự khai;
// chỉ tính khoá ĐANG HỌC (không lộ ghi danh chờ phụ huynh xác nhận); SĐT sai bị từ chối; giới hạn theo IP (phút + ngày) và theo từng số.
// Phần giới hạn thời gian chạy TRỰC TIẾP hàm POST của route với Date.now giả (bộ đếm nằm trong bộ nhớ tiến trình nên bài HTTP không thể "tua" thời gian).
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { POST as lookupPOST } from "@/app/api/tra-cuu/route";
import { LOOKUP_LIMITS } from "@/lib/lookupPrivacy";

const U = "/api/tra-cuu";
let ipSeq = 0;
// Mỗi yêu cầu một IP riêng (máy chủ lấy IP CUỐI của x-forwarded-for) để các ca không chặn lẫn nhau.
const ipHeader = () => ({ "x-forwarded-for": `10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}` });
// SĐT ngẫu nhiên mỗi lần chạy: bộ đếm theo số nằm trong bộ nhớ máy chủ dev nên chạy lại trong 10 phút không được dùng lại số cũ.
const rnd = () => "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const look = (phone: unknown, o: { as?: Awaited<ReturnType<typeof mkUser>>; ip?: Record<string, string> } = {}) => api("POST", U, { as: o.as, body: { phone }, headers: o.ip ?? ipHeader() });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const C1 = await mkCourse(T.id, { name: "Sử 12 nâng cao" }), C2 = await mkCourse(T.id, { name: "Địa 12" }), C3 = await mkCourse(T.id, { name: "Văn 12 chờ duyệt" }), C4 = await mkCourse(T.id, { name: "Toán 12 tạm dừng" });
  const A = await mkUser({ name: "Nguyễn Văn Thọ" }), D = await mkUser({ name: "Trần Thị Lan" }), B = await mkUser({ name: "Lê Hoàng" }), E = await mkUser({ name: "Phạm Minh" });
  const PA = rnd(), PP = rnd(), PB = rnd(), PE = rnd();
  await prisma.user.update({ where: { id: A.id }, data: { phone: PA, parentPhone: PP, studentId: 4242 } });
  await prisma.user.update({ where: { id: D.id }, data: { phone: PA, studentId: 4243 } }); // anh chị em dùng chung một số
  await prisma.user.update({ where: { id: B.id }, data: { phone: PB } });
  await prisma.user.update({ where: { id: E.id }, data: { phone: PE } });
  for (const [u, c, status] of [[A, C1, "active"], [A, C2, "active"], [A, C3, "pending_consent"], [A, C4, "suspended"], [D, C2, "active"]] as const)
    await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status } });

  section("Người lạ: chỉ tên che + số khoá");
  const anon = await look(PA);
  check("khách tra số của học sinh → 200, 2 kết quả (hai tài khoản cùng số)", anon.status === 200 && anon.json.results.length === 2, anon.json);
  const ra = anon.json.results.find((r: { name: string }) => r.name.startsWith("Nguyễn")), rd = anon.json.results.find((r: { name: string }) => r.name.startsWith("Trần"));
  check("tên che: 'Nguyễn V. T.' và 'Trần T. L.'", ra?.name === "Nguyễn V. T." && rd?.name === "Trần T. L.", anon.json);
  check("chỉ tính khoá ĐANG HỌC: A có 4 ghi danh (2 đang học, 1 chờ phụ huynh, 1 tạm dừng) → courseCount = 2; D = 1", ra?.courseCount === 2 && rd?.courseCount === 1, anon.json);
  check("detail=false ở mọi kết quả", anon.json.results.every((r: { detail: boolean }) => r.detail === false));
  check("thân trả lời KHÔNG chứa tên thật, mã học viên, tên / mã khoá (kể cả khoá chờ duyệt, tạm dừng), chữ 'courses' / 'studentId'", !/Thọ|Văn Thọ|4242|4243|Sử 12|Địa 12|Văn 12|Toán 12|lop-|"courses"|"studentId"|"shortTitle"/.test(anon.text), anon.text);

  section("Không khớp SĐT phụ huynh tự khai");
  const byParent = await look(PP);
  check("tra bằng SĐT phụ huynh trong hồ sơ → 404 (trước đây ra tên + khoá của con)", byParent.status === 404 && !/Nguyễn|Thọ/.test(byParent.text), byParent.json);
  const nf = await look(rnd());
  check("số không có ai → 404, câu báo không nhắc 'phụ huynh'", nf.status === 404 && typeof nf.json.error === "string" && !/phụ huynh/i.test(nf.json.error), nf.json);

  section("Chính học sinh: thấy đủ (và chỉ của mình)");
  const own = await look(PA, { as: A });
  const oa = own.json.results.find((r: { name: string }) => r.name === "Nguyễn Văn Thọ"), od = own.json.results.find((r: { detail: boolean; name: string }) => r.name !== "Nguyễn Văn Thọ");
  check("A đăng nhập, tra số của mình → bản của A là đủ: tên thật, mã 4242, đúng 2 khoá đang học", own.status === 200 && oa?.detail === true && oa.studentId === 4242 && oa.courses.length === 2 && oa.courses.some((c: { name: string }) => c.name === "Sử 12 nâng cao") && !oa.courses.some((c: { name: string }) => /chờ duyệt|tạm dừng/.test(c.name)), own.json);
  check("…nhưng anh/chị em D (cùng số, tài khoản khác) vẫn bị che: 'Trần T. L.', không mã 4243, không khoá", od?.detail === false && od.name === "Trần T. L." && !/4243/.test(own.text), own.json);
  const asD = await look(PA, { as: D });
  check("D đăng nhập → bản của D là đủ (mã 4243), bản của A bị che", asD.json.results.find((r: { name: string }) => r.name === "Trần Thị Lan")?.detail === true && asD.json.results.find((r: { name: string }) => r.name.startsWith("Nguyễn"))?.detail === false && !/4242/.test(asD.text), asD.json);
  const asB = await look(PA, { as: B });
  check("học sinh khác (B) tra số của A → bị che hết", asB.json.results.every((r: { detail: boolean }) => r.detail === false) && !/4242|4243|Thọ/.test(asB.text), asB.json);
  const asT = await look(PA, { as: T });
  check("gia sư đăng nhập tra → cũng chỉ thấy bản che (không đặc quyền ở trang công khai)", asT.json.results.every((r: { detail: boolean }) => r.detail === false) && !/4242|Thọ/.test(asT.text), asT.json);
  const noCourse = await look(PB, { as: B });
  check("học sinh chưa học khoá nào (B): bản đủ có courses rỗng", noCourse.status === 200 && noCourse.json.results[0].detail === true && noCourse.json.results[0].courses.length === 0, noCourse.json);
  const bad = await api("POST", U, { body: { phone: PB }, headers: { ...ipHeader(), cookie: "midnight_session=rac-ruoi" } });
  check("cookie phiên hỏng → coi như khách (200, bản che), KHÔNG 500", bad.status === 200 && bad.json.results.every((r: { detail: boolean }) => r.detail === false), bad.status); // PB: số PA đã đủ 5 lượt ở các ca trên

  section("Số điện thoại / thân yêu cầu sai → 400 (không 500)");
  for (const [name, v] of [["lỗ hổng cũ '0|12345678'", "0|12345678"], ["chữ", "abcdefghij"], ["thiếu số", "090123456"], ["đầu 02", "0201234567"], ["+84", "+84901234567"], ["số (không phải chuỗi)", 901234567], ["mảng", [PA]], ["đối tượng", { a: 1 }], ["rỗng", ""], ["null", null]] as const) {
    const r = await look(v);
    check(`phone = ${name} → 400`, r.status === 400, r.status);
  }
  check("không có trường phone → 400", (await api("POST", U, { body: {}, headers: ipHeader() })).status === 400);
  check("thân không phải JSON → 400", (await api("POST", U, { raw: "{hỏng", headers: { "content-type": "application/json", ...ipHeader() } })).status === 400);
  check("thân là mảng → 400", (await api("POST", U, { body: [PA], headers: ipHeader() })).status === 400);
  check("số có dấu cách '09xx xxx xxx' vẫn nhận (bỏ khoảng trắng)", (await look(PE.slice(0, 4) + " " + PE.slice(4, 7) + " " + PE.slice(7))).status === 200);

  section("Giới hạn theo từng số (qua HTTP, IP khác nhau mỗi lần)");
  const PL = rnd(); await prisma.user.update({ where: { id: E.id }, data: { phone: PL } });
  const codes: number[] = [];
  for (let i = 0; i < LOOKUP_LIMITS.phonePerWindow + 1; i++) codes.push((await look(PL)).status);
  check(`${LOOKUP_LIMITS.phonePerWindow} lần đầu cho cùng một số → 200; lần ${LOOKUP_LIMITS.phonePerWindow + 1} → 429 dù IP đổi liên tục`, codes.slice(0, LOOKUP_LIMITS.phonePerWindow).every(c => c === 200) && codes[LOOKUP_LIMITS.phonePerWindow] === 429, codes);
  const r429 = await look(PL);
  check("429 có Retry-After và câu báo tiếng Việt", r429.status === 429 && Number(r429.headers.get("retry-after")) > 0 && /Quá nhiều/.test(r429.json.error), r429.json);
  check("số KHÁC vẫn tra được (giới hạn theo số, không khoá cả hệ thống)", (await look(PB)).status === 200);

  section("Giới hạn theo IP trong một phút (qua HTTP, số khác nhau mỗi lần)");
  const fixed = { "x-forwarded-for": `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` }; // ngẫu nhiên: chạy lại trong vòng một phút không dính bộ đếm cũ
  const ipCodes: number[] = [];
  for (let i = 0; i < LOOKUP_LIMITS.ipPerMinute + 1; i++) ipCodes.push((await look(rnd(), { ip: fixed })).status);
  check(`${LOOKUP_LIMITS.ipPerMinute} lần đầu từ một IP (số khác nhau) → không bị chặn; lần ${LOOKUP_LIMITS.ipPerMinute + 1} → 429`, ipCodes.slice(0, LOOKUP_LIMITS.ipPerMinute).every(c => c !== 429) && ipCodes[LOOKUP_LIMITS.ipPerMinute] === 429, ipCodes);
  check("IP khác không bị ảnh hưởng", (await look(rnd())).status !== 429);

  section("Giới hạn theo ngày + cửa sổ thời gian (chạy trực tiếp route với Date.now giả)");
  const realNow = Date.now;
  let clock = realNow.call(Date);
  Date.now = () => clock;
  const post = async (phone: unknown, ip: string) => (await lookupPOST(new Request("http://t/api/tra-cuu", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ phone }) }))).status;
  try {
    const DAY_IP = "203.0.113.9";
    const dayCodes: number[] = [];
    for (let i = 0; i < LOOKUP_LIMITS.ipPerDay; i++) {
      if (i > 0 && i % LOOKUP_LIMITS.ipPerMinute === 0) clock += 61_000; // sang phút mới để chỉ còn trần theo NGÀY
      dayCodes.push(await post(rnd(), DAY_IP));
    }
    check(`${LOOKUP_LIMITS.ipPerDay} lần trong ngày (mỗi phút ≤ ${LOOKUP_LIMITS.ipPerMinute}) → không lần nào 429`, dayCodes.every(c => c !== 429), dayCodes.filter(c => c === 429).length);
    clock += 61_000;
    check(`lần thứ ${LOOKUP_LIMITS.ipPerDay + 1} trong cùng ngày → 429 dù phút mới (trần theo ngày)`, (await post(rnd(), DAY_IP)) === 429);
    clock += 24 * 3600_000;
    check("sau hơn 24 giờ → tra lại được", (await post(rnd(), DAY_IP)) !== 429);

    const PW = rnd(); await prisma.user.update({ where: { id: E.id }, data: { phone: PW } });
    const wc: number[] = [];
    for (let i = 0; i < LOOKUP_LIMITS.phonePerWindow + 1; i++) wc.push(await post(PW, `192.0.2.${i + 1}`));
    check("cùng một số: lần 6 → 429", wc[LOOKUP_LIMITS.phonePerWindow] === 429 && wc.slice(0, LOOKUP_LIMITS.phonePerWindow).every(c => c === 200), wc);
    clock += LOOKUP_LIMITS.phoneWindowMs - 1000;
    check("còn 1 giây nữa mới hết cửa sổ 10 phút → vẫn 429", (await post(PW, "192.0.2.50")) === 429);
    clock += 2000;
    check("hết cửa sổ 10 phút → tra lại được", (await post(PW, "192.0.2.51")) === 200);
  } finally { Date.now = realNow; }

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
